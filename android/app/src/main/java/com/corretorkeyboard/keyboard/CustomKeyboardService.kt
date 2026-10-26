package com.corretorkeyboard.keyboard

import android.content.ClipDescription
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.inputmethodservice.InputMethodService
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.net.Uri
import android.text.TextUtils
import android.util.Log
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.view.ContextThemeWrapper
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.core.view.inputmethod.EditorInfoCompat
import androidx.core.view.inputmethod.InputConnectionCompat
import androidx.core.view.inputmethod.InputContentInfoCompat
import com.corretorkeyboard.R
import com.facebook.react.ReactApplication
import com.facebook.react.ReactInstanceManager
import com.facebook.react.ReactRootView
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.lang.ref.WeakReference

/**
 * CustomKeyboardService
 * ---------------------------------------------------------------------------
 * Ponto de entrada do TECLADO no Android. O sistema cria esta classe quando o
 * usuário seleciona "KEYCON" e um campo de texto recebe foco em
 * QUALQUER app (ex.: WhatsApp).
 *
 * Arquitetura da ponte:
 *
 *   ┌──────────── WhatsApp (outro processo) ────────────┐
 *   │  EditText  ◄──── InputConnection (Binder IPC) ────┼──┐
 *   └───────────────────────────────────────────────────┘  │
 *                                                          │
 *   ┌──────────── Nosso processo ──────────────────────────┼──┐
 *   │ CustomKeyboardService (InputMethodService)  ─────────┘  │
 *   │    └─ onCreateInputView() → ReactRootView               │
 *   │          └─ JS: AppRegistry "CorretorKeyboard"          │
 *   │ KeyboardBridgeModule (NativeModule) ──► service.commit  │
 *   └─────────────────────────────────────────────────────────┘
 *
 * Reaproveitamos o MESMO ReactInstanceManager do MainApplication: o JS bundle
 * é carregado uma única vez e app + teclado compartilham MMKV/estado.
 *
 * NOTA (New Architecture / Bridgeless, RN ≥ 0.74 com newArchEnabled=true):
 * substitua ReactRootView por `reactHost.createSurface(this, MODULE_NAME, props)`
 * e use `surface.view`. O resto do ciclo de vida permanece igual.
 */
class CustomKeyboardService : InputMethodService() {

    companion object {
        /** Nome registrado via AppRegistry.registerComponent no index.js */
        const val MODULE_NAME = "CorretorKeyboard"

        /** Altura total do teclado (toolbar + conteúdo + barra inferior) em pé. */
        private const val KEYBOARD_HEIGHT_DP = 320

        /**
         * Celular deitado: a tela tem ~360-410dp de altura, então 320dp cobriria
         * quase tudo. Usamos no máximo metade da altura, com um piso legível.
         */
        private const val LANDSCAPE_SCREEN_FRACTION = 0.5f
        private const val MIN_LANDSCAPE_HEIGHT_DP = 180

        /**
         * Teclado expandido (CRM em tela grande): ocupa quase a tela toda e
         * deixa só uma faixa do app em cima, para a pessoa saber onde está.
         */
        private const val EXPANDED_SCREEN_FRACTION = 0.88f
        /** Tamanho intermediário (Atalhos): metade da tela, nunca menor que o normal + 90 dp. */
        private const val TALL_SCREEN_FRACTION = 0.5f
        private const val TALL_EXTRA_DP = 90

        /** Tamanhos do teclado pedidos pelo JS (KeyboardBridge.setHeightMode). */
        const val HEIGHT_NORMAL = 0
        const val HEIGHT_TALL = 1
        const val HEIGHT_EXPANDED = 2

        /** Sem a tela do JS após esse tempo, o placeholder mostra o diagnóstico e os botões. */
        private const val LOAD_TIMEOUT_MS = 10_000L
        private const val TAG = "CustomKeyboardService"

        /**
         * Último erro JS reportado via KeyboardBridge.reportError. Fica no companion
         * porque o JS pode reportar antes de o serviço existir.
         */
        @Volatile
        var lastJsError: String? = null

        // Eventos emitidos ao JS
        const val EVENT_KEYBOARD_SHOW = "onKeyboardShow"
        const val EVENT_KEYBOARD_HIDE = "onKeyboardHide"

        /**
         * Referência fraca para que o NativeModule encontre o serviço ativo
         * sem causar memory leak quando o sistema destruir o IME.
         */
        @Volatile
        private var instanceRef: WeakReference<CustomKeyboardService>? = null
        val instance: CustomKeyboardService? get() = instanceRef?.get()
    }

    private var rootContainer: KeyboardRootFrameLayout? = null
    private var reactRootView: ReactRootView? = null

    // Placeholder nativo exibido até a tela do JS aparecer
    private var loadingLayout: LinearLayout? = null
    private var loadingSubtitle: TextView? = null
    private var loadingProgress: ProgressBar? = null
    private var loadingActions: LinearLayout? = null

    /**
     * Tamanho pedido pelo JS (normal, intermediário ou tela grande). Volta ao
     * normal quando o teclado fecha; o JS pede de novo ao reabrir.
     */
    private var heightMode = HEIGHT_NORMAL

    /** O JS avisa (KeyboardBridge.notifyReady) quando a tela do teclado montou. */
    private var jsReady = false
    private val mainHandler = Handler(Looper.getMainLooper())
    private val loadTimeout = Runnable { showLoadProblem() }

    /** Pacote do app em foco (ex.: "com.whatsapp"). */
    var targetPackage: String? = null
        private set

    private val reactInstanceManager: ReactInstanceManager
        get() = (application as ReactApplication).reactNativeHost.reactInstanceManager

    /**
     * Container raiz do teclado com medição determinística de altura.
     * O Android InputMethodService injeta a view dentro de um container com WRAP_CONTENT.
     * Sem forçar MeasureSpec.EXACTLY no onMeasure, a ReactRootView (que ainda não tem filhos nativos
     * antes do JS carregar) colapsaria para 0 pixels de altura, tornando o teclado invisível.
     */
    private class KeyboardRootFrameLayout(
        context: android.content.Context,
        initialHeightPx: Int
    ) : FrameLayout(context) {
        /** Pode mudar ao girar o celular; o filho (ReactRootView) acompanha via MATCH_PARENT. */
        var targetHeightPx: Int = initialHeightPx
            set(value) {
                if (field == value) return
                field = value
                minimumHeight = value
                layoutParams?.let { it.height = value; layoutParams = it }
                requestLayout()
            }

        override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
            val forcedHeightSpec = MeasureSpec.makeMeasureSpec(targetHeightPx, MeasureSpec.EXACTLY)
            super.onMeasure(widthMeasureSpec, forcedHeightSpec)
            setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec), targetHeightPx)
        }
    }

    // -----------------------------------------------------------------------
    // Ciclo de vida do IME
    // -----------------------------------------------------------------------

    override fun onCreate() {
        super.onCreate()
        instanceRef = WeakReference(this)

        // Começa a carregar o JS já na criação do serviço, antes do primeiro campo pedir o teclado
        try {
            if (!reactInstanceManager.hasStartedCreatingInitialContext()) {
                reactInstanceManager.createReactContextInBackground()
            }
        } catch (t: Throwable) {
            Log.w(TAG, "Pré-carregamento do JS ignorado: ${t.message}")
        }
    }

    /**
     * Força o sistema Android a SEMPRE exibir a visualização do teclado quando solicitado.
     */
    override fun onEvaluateInputViewShown(): Boolean = true

    /** Nunca usar modo "fullscreen" (landscape) — quebraria o layout RN. */
    override fun onEvaluateFullscreenMode(): Boolean = false

    /**
     * Chamado para criar ou obter a View do teclado.
     */
    override fun onCreateInputView(): View {
        // O sistema chama de novo ao girar a tela: reaproveita a view e só ajusta a altura
        rootContainer?.let { container ->
            (container.parent as? ViewGroup)?.removeView(container)
            container.targetHeightPx = keyboardHeightPx()
            return container
        }

        val themedContext = ContextThemeWrapper(this, R.style.AppTheme)
        val heightPx = keyboardHeightPx()

        val container = KeyboardRootFrameLayout(themedContext, heightPx).apply {
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, heightPx)
            minimumHeight = heightPx
            setBackgroundColor(Color.parseColor("#1A1D24"))
        }

        // 1) Placeholder nativo imediato: garante visualização visível mesmo durante cold-start do JS
        container.addView(buildLoadingLayout(themedContext))

        // 2) ReactRootView: sobrepõe o placeholder assim que renderizar o primeiro frame
        attachReactRootView(container)

        rootContainer = container
        return container
    }

    private fun buildLoadingLayout(context: android.content.Context): LinearLayout {
        val density = resources.displayMetrics.density
        val layout = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#1A1D24"))
            val pad = (16 * density).toInt()
            setPadding(pad, 0, pad, 0)
            layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
        }

        val titleView = TextView(context).apply {
            text = "KEYCON"
            setTextColor(Color.parseColor("#FFFFFF"))
            textSize = 15f
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
        }

        val subtitleView = TextView(context).apply {
            text = "Carregando catálogo e atalhos..."
            setTextColor(Color.parseColor("#8C93A1"))
            textSize = 12f
            gravity = Gravity.CENTER
            setPadding(0, (6 * density).toInt(), 0, (12 * density).toInt())
        }

        val progressBar = ProgressBar(context).apply {
            isIndeterminate = true
        }

        // Botões exibidos só quando o carregamento falha
        val actions = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            visibility = View.GONE
            addView(Button(context).apply {
                text = "Tentar novamente"
                setOnClickListener { reloadReactView() }
            })
            addView(Button(context).apply {
                text = "Trocar teclado"
                setOnClickListener { switchKeyboard() }
            })
        }

        layout.addView(titleView)
        layout.addView(subtitleView)
        layout.addView(progressBar)
        layout.addView(actions)

        loadingLayout = layout
        loadingSubtitle = subtitleView
        loadingProgress = progressBar
        loadingActions = actions
        return layout
    }

    private fun attachReactRootView(container: FrameLayout) {
        try {
            // ATENÇÃO: pegar o manager FORA do apply. Dentro dele, "reactInstanceManager"
            // seria a propriedade da própria ReactRootView (ainda nula), não a do serviço —
            // era isso que deixava o teclado preso em "Carregando...".
            val manager = this.reactInstanceManager
            val rootView = ReactRootView(container.context)
            rootView.startReactApplication(
                manager,
                MODULE_NAME,
                Bundle().apply { putString("platform", "android-ime") }
            )
            reactRootView = rootView
            container.addView(rootView, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        } catch (t: Throwable) {
            lastJsError = "Falha ao iniciar a view do teclado: ${t.message}"
            Log.e(TAG, "Falha ao inicializar ReactRootView do teclado", t)
        }
    }

    /**
     * O teclado ficou visível para um novo campo de texto.
     */
    override fun onStartInputView(info: EditorInfo?, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        val newPackage = info?.packageName
        // Se mudou de app (outro pacote), volta ao tamanho normal
        if (targetPackage != null && newPackage != null && targetPackage != newPackage) {
            heightMode = HEIGHT_NORMAL
        }
        targetPackage = newPackage

        // Ajusta a altura do teclado à orientação atual. A JANELA do IME fica em
        // WRAP_CONTENT: nos Android recentes ela também desenha a barra de navegação
        // embaixo; travar a janela na altura do conteúdo fazia essa barra cobrir
        // (cortar) a parte de baixo do teclado.
        try {
            rootContainer?.targetHeightPx = keyboardHeightPx()
            window?.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        } catch (_: Throwable) {}

        try {
            if (reactInstanceManager.lifecycleState != com.facebook.react.common.LifecycleState.RESUMED) {
                reactInstanceManager.onHostResume(null)
            }
        } catch (t: Throwable) {
            Log.w(TAG, "onHostResume ignorado: ${t.message}")
        }

        // Se a tela do JS ainda não apareceu, mostra o diagnóstico após o tempo limite
        if (isKeyboardHealthy()) hidePlaceholderIfHealthy() else scheduleLoadTimeout()

        emitToJs(EVENT_KEYBOARD_SHOW, Arguments.createMap().apply {
            putString("targetPackage", targetPackage ?: "")
            putBoolean("restarting", restarting)
            putInt("inputType", info?.inputType ?: 0)
        })
    }

    override fun onFinishInputView(finishingInput: Boolean) {
        super.onFinishInputView(finishingInput)
        if (heightMode != HEIGHT_NORMAL) {
            heightMode = HEIGHT_NORMAL
            rootContainer?.targetHeightPx = keyboardHeightPx()
        }
        try {
            emitToJs(EVENT_KEYBOARD_HIDE, Arguments.createMap())
        } catch (_: Throwable) {}
    }

    override fun onDestroy() {
        mainHandler.removeCallbacks(loadTimeout)
        try {
            reactRootView?.unmountReactApplication()
        } catch (_: Throwable) {}
        reactRootView = null
        rootContainer = null
        loadingLayout = null
        loadingSubtitle = null
        loadingProgress = null
        loadingActions = null
        if (instanceRef?.get() === this) instanceRef = null
        super.onDestroy()
    }

    // -----------------------------------------------------------------------
    // (B) INTERAÇÃO COM O CAMPO DE TEXTO — InputConnection
    // Todos os métodos abaixo DEVEM ser chamados na Main Thread.
    // -----------------------------------------------------------------------

    /**
     * Injeta texto no campo ativo do app em foco (WhatsApp).
     *
     * commitText(text, newCursorPosition = 1) → insere o texto na posição do
     * cursor (substituindo seleção, se houver) e posiciona o cursor ao final.
     * beginBatchEdit/endBatchEdit agrupam a operação, evitando que o app
     * receba vários callbacks intermediários (flicker / autocorreção).
     */
    fun commitText(text: String): Boolean {
        val ic = currentInputConnection ?: return false
        ic.beginBatchEdit()
        val ok = ic.commitText(text, 1)
        ic.endBatchEdit()
        return ok
    }

    /** Backspace: apaga a seleção, ou 1 caractere antes do cursor. */
    /** Tamanho (em chars) do último caractere visível do texto. */
    private fun lastGraphemeLength(text: String): Int {
        val it = android.icu.text.BreakIterator.getCharacterInstance()
        it.setText(text)
        val start = it.preceding(text.length)
        return if (start == android.icu.text.BreakIterator.DONE) 1 else (text.length - start).coerceAtLeast(1)
    }

    fun deleteBackward(): Boolean {
        val ic = currentInputConnection ?: return false
        val selected = ic.getSelectedText(0)
        if (!TextUtils.isEmpty(selected)) return ic.commitText("", 1)

        // Retorna false quando não há nada antes do cursor: o JS usa isso para
        // parar a repetição do ⌫ (antes ela seguia "apagando" para sempre).
        val before = ic.getTextBeforeCursor(32, 0)
        if (before != null && before.isEmpty()) return false

        // Apaga o último "caractere visível" inteiro: emojis compostos (❤️, 👍🏽,
        // bandeiras, 👨‍💼) têm vários códigos e não podem ficar pela metade
        val count = if (before.isNullOrEmpty()) 1 else lastGraphemeLength(before.toString())
        return ic.deleteSurroundingText(count, 0)
    }

    /**
     * Texto antes do cursor (até 200 caracteres) e o tipo do campo. O teclado
     * usa isso para a maiúscula automática e as sugestões de palavras.
     */
    fun inputContext(): com.facebook.react.bridge.WritableMap {
        val map = Arguments.createMap()
        val ic = currentInputConnection
        map.putString("before", ic?.getTextBeforeCursor(200, 0)?.toString() ?: "")
        map.putInt("inputType", currentInputEditorInfo?.inputType ?: 0)
        return map
    }

    /** Troca os `count` caracteres antes do cursor por `text` numa só edição (sugestões). */
    fun replaceTextBeforeCursor(count: Int, text: String): Boolean {
        val ic = currentInputConnection ?: return false
        ic.beginBatchEdit()
        if (count > 0) ic.deleteSurroundingText(count, 0)
        val ok = ic.commitText(text, 1)
        ic.endBatchEdit()
        return ok
    }

    /** O cursor mudou (digitação, toque no texto, colar...): o JS confere o contexto. */
    override fun onUpdateSelection(
        oldSelStart: Int, oldSelEnd: Int,
        newSelStart: Int, newSelEnd: Int,
        candidatesStart: Int, candidatesEnd: Int,
    ) {
        super.onUpdateSelection(oldSelStart, oldSelEnd, newSelStart, newSelEnd, candidatesStart, candidatesEnd)
        val params = Arguments.createMap()
        params.putInt("start", newSelStart)
        params.putInt("end", newSelEnd)
        emitToJs("onSelectionChange", params)
    }

    /**
     * Enter: se o campo define uma IME action (Send/Search/Go) dispara-a;
     * caso contrário (WhatsApp multiline) envia KEYCODE_ENTER → nova linha.
     */
    fun sendEnter(): Boolean {
        val ic = currentInputConnection ?: return false
        val ei = currentInputEditorInfo
        val action = (ei?.imeOptions ?: 0) and EditorInfo.IME_MASK_ACTION
        val noEnterAction = ((ei?.imeOptions ?: 0) and EditorInfo.IME_FLAG_NO_ENTER_ACTION) != 0

        return if (!noEnterAction &&
            action != EditorInfo.IME_ACTION_NONE &&
            action != EditorInfo.IME_ACTION_UNSPECIFIED
        ) {
            ic.performEditorAction(action)
        } else {
            sendDownUpKeyEvents(KeyEvent.KEYCODE_ENTER)
            true
        }
    }

    /**
     * Formatos de arquivo que o campo em foco aceita receber do teclado
     * (ex.: WhatsApp → image/gif, image/png...). Vazio = o campo só aceita texto.
     */
    fun acceptedContentMimeTypes(): Array<String> =
        currentInputEditorInfo?.let { EditorInfoCompat.getContentMimeTypes(it) } ?: emptyArray()

    /**
     * Entrega uma imagem já baixada direto na conversa — o mesmo recurso que o
     * Gboard usa para GIFs e figurinhas (commitContent). O app de destino recebe
     * permissão temporária de leitura do arquivo.
     */
    fun commitImage(media: MediaFiles.Downloaded, description: String, linkUrl: String?): Boolean {
        val ic = currentInputConnection ?: return false
        val editorInfo = currentInputEditorInfo ?: return false
        val uri = MediaFiles.uriFor(this, media.file)
        val info = InputContentInfoCompat(
            uri,
            ClipDescription(description, arrayOf(media.mimeType)),
            linkUrl?.let { Uri.parse(it) }
        )
        // No Android 7.0 (API 24) a permissão precisa ser concedida manualmente
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N_MR1) {
            grantUriPermission(editorInfo.packageName, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        return InputConnectionCompat.commitContent(
            ic, editorInfo, info, InputConnectionCompat.INPUT_CONTENT_GRANT_READ_URI_PERMISSION, null
        )
    }

    /**
     * Tecla 🌐: volta ao teclado anterior (Gboard etc.) para digitação livre.
     * API 28+ possui switchToPreviousInputMethod(); abaixo disso, abre o picker.
     */
    fun switchKeyboard() {
        try {
            val switched = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                switchToPreviousInputMethod()
            } else false

            if (!switched) {
                val imm = getSystemService(INPUT_METHOD_SERVICE) as? InputMethodManager
                imm?.showInputMethodPicker()
            }
        } catch (t: Throwable) {
            Log.w(TAG, "Não foi possível alternar método de entrada: ${t.message}")
        }
    }

    // -----------------------------------------------------------------------
    // Diagnóstico de carregamento
    // -----------------------------------------------------------------------

    /** Chamado pelo KeyboardBridgeModule quando a tela do JS montou. */
    fun markJsReady() {
        jsReady = true
        // As views nativas chegam logo depois do useEffect do JS
        mainHandler.postDelayed({ hidePlaceholderIfHealthy() }, 300)
    }

    /** Esconde o placeholder (que pode ter ido para a frente ao mostrar o diagnóstico). */
    private fun hidePlaceholderIfHealthy() {
        if (isKeyboardHealthy()) {
            mainHandler.removeCallbacks(loadTimeout)
            loadingLayout?.visibility = View.GONE
        }
    }

    /** O JS montou a tela e a ReactRootView já tem views nativas desenhadas. */
    private fun isKeyboardHealthy(): Boolean = jsReady && (reactRootView?.childCount ?: 0) > 0

    private fun scheduleLoadTimeout() {
        mainHandler.removeCallbacks(loadTimeout)
        mainHandler.postDelayed(loadTimeout, LOAD_TIMEOUT_MS)
    }

    /** Troca o "Carregando..." por uma mensagem com o ponto onde parou e os botões de ação. */
    private fun showLoadProblem() {
        if (isKeyboardHealthy()) return
        val ctx = try { reactInstanceManager.currentReactContext } catch (_: Throwable) { null }
        val details = buildString {
            append("JS: ").append(if (ctx != null) "carregado" else "não carregado")
            append(" • tela: ").append(if (jsReady) "montada" else "não montada")
            append(" • views: ").append(reactRootView?.childCount ?: -1)
            append(" • estado: ").append(try { reactInstanceManager.lifecycleState } catch (_: Throwable) { "?" })
            lastJsError?.let { append("\nErro: ").append(it.take(300)) }
        }
        Log.e(TAG, "Teclado não carregou: $details")

        loadingSubtitle?.text = "Não foi possível carregar o teclado.\n$details"
        loadingProgress?.visibility = View.GONE
        loadingActions?.visibility = View.VISIBLE
        // A ReactRootView vazia fica por cima e capturaria os toques nos botões
        loadingLayout?.bringToFront()
    }

    /** Botão "Tentar novamente": recria a ReactRootView (e o contexto JS, se ele nunca subiu). */
    private fun reloadReactView() {
        val container = rootContainer ?: return
        reactRootView?.let { old ->
            try { old.unmountReactApplication() } catch (_: Throwable) {}
            container.removeView(old)
        }
        reactRootView = null
        jsReady = false
        lastJsError = null

        loadingLayout?.visibility = View.VISIBLE
        loadingSubtitle?.text = "Carregando catálogo e atalhos..."
        loadingProgress?.visibility = View.VISIBLE
        loadingActions?.visibility = View.GONE

        try {
            if (reactInstanceManager.currentReactContext == null &&
                reactInstanceManager.hasStartedCreatingInitialContext()
            ) {
                reactInstanceManager.recreateReactContextInBackground()
            }
        } catch (t: Throwable) {
            Log.w(TAG, "Recriação do contexto JS ignorada: ${t.message}")
        }

        attachReactRootView(container)
        scheduleLoadTimeout()
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    /**
     * Expande o teclado para quase a tela toda (ou volta ao normal). O app de
     * baixo continua com o campo de texto em foco: o que o JS inserir vai
     * direto para a conversa.
     */
    /**
     * Vibração curta de "pegou o item" (segurar um botão do menu para arrastar).
     * Segue a vibração ao toque do Android e não precisa de permissão.
     */
    fun hapticLongPress(): Boolean {
        val view = rootContainer ?: return false
        return view.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS, HapticFeedbackConstants.FLAG_IGNORE_VIEW_SETTING)
    }

    fun setExpanded(value: Boolean): Boolean {
        return setHeightMode(if (value) HEIGHT_EXPANDED else HEIGHT_NORMAL)
    }

    /** Normal, intermediário (Atalhos) ou tela grande (formulários, CRM, Agenda). */
    fun setHeightMode(mode: Int): Boolean {
        heightMode = mode.coerceIn(HEIGHT_NORMAL, HEIGHT_EXPANDED)
        rootContainer?.targetHeightPx = keyboardHeightPx()
        return true
    }

    /**
     * Mostra o teclado de novo depois que a galeria, a câmera ou o pedido de
     * permissão (abertos pelo próprio teclado) fecham: o campo da conversa
     * continua em foco, mas o Android não reabre o teclado sozinho. Tenta logo
     * e mais uma vez, para dar tempo de a conversa voltar para a frente.
     */
    fun showAgainSoon() {
        val attempt = Runnable {
            if (isInputViewShown) return@Runnable
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    requestShowSelf(0)
                } else {
                    val token = window?.window?.attributes?.token ?: return@Runnable
                    @Suppress("DEPRECATION")
                    (getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager).showSoftInputFromInputMethod(token, 0)
                }
            } catch (_: Throwable) {
                // Sem campo em foco (a pessoa saiu da conversa): fica fechado
            }
        }
        mainHandler.postDelayed(attempt, 350)
        mainHandler.postDelayed(attempt, 900)
    }

    /** Altura do teclado em pixels para a orientação atual da tela. */
    private fun keyboardHeightPx(): Int {
        val metrics = resources.displayMetrics
        val portraitPx = (KEYBOARD_HEIGHT_DP * metrics.density).toInt()
        if (heightMode == HEIGHT_EXPANDED) {
            return (metrics.heightPixels * EXPANDED_SCREEN_FRACTION).toInt().coerceAtLeast(portraitPx)
        }
        if (heightMode == HEIGHT_TALL) {
            val minTall = portraitPx + (TALL_EXTRA_DP * metrics.density).toInt()
            return (metrics.heightPixels * TALL_SCREEN_FRACTION).toInt().coerceAtLeast(minTall)
        }
        if (resources.configuration.orientation != Configuration.ORIENTATION_LANDSCAPE) {
            return portraitPx
        }
        val minPx = (MIN_LANDSCAPE_HEIGHT_DP * metrics.density).toInt()
        val fractionPx = (metrics.heightPixels * LANDSCAPE_SCREEN_FRACTION).toInt()
        return fractionPx.coerceIn(minPx, portraitPx)
    }

    private fun emitToJs(event: String, params: Any) {
        try {
            val ctx: ReactContext = reactInstanceManager.currentReactContext ?: return
            if (!ctx.hasActiveReactInstance()) return
            ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(event, params)
        } catch (_: Throwable) {}
    }
}
