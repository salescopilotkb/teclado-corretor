package com.corretorkeyboard.keyboard

import android.content.Context
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Rect
import android.net.ConnectivityManager
import android.net.Uri
import android.provider.Settings
import android.view.inputmethod.InputMethodManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import java.util.concurrent.Executors

/**
 * KeyboardBridgeModule
 * ---------------------------------------------------------------------------
 * NativeModule exposto ao JS como `NativeModules.KeyboardBridge`.
 *
 * Fornece:
 * 1. Métodos de injeção e navegação no InputConnection (insertText, deleteBackward, sendEnter).
 * 2. Alternância de teclado e controle de sistema (switchKeyboard, openInputMethodPicker).
 * 3. Status de ativação e seleção para o onboarding (isKeyboardEnabled, isKeyboardSelected).
 * 4. Envio de arquivos: foto direto na conversa (commitImage) e compartilhamento
 *    de áudio, vídeo e várias fotos (shareMedia).
 */
class KeyboardBridgeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "KeyboardBridge"

    /** Downloads fora da main thread, um por vez. */
    private val downloads = Executors.newSingleThreadExecutor()

    /** Pré-download em segundo plano, separado: nunca atrasa um envio que a pessoa pediu. */
    private val prefetches = Executors.newSingleThreadExecutor()

    private inline fun withService(promise: Promise, crossinline block: (CustomKeyboardService) -> Any?) {
        UiThreadUtil.runOnUiThread {
            val service = CustomKeyboardService.instance
            if (service == null) {
                promise.reject("E_IME_INACTIVE", "O teclado KEYCON não está ativo.")
                return@runOnUiThread
            }
            try {
                promise.resolve(block(service))
            } catch (t: Throwable) {
                promise.reject("E_IME_FAILURE", t.message, t)
            }
        }
    }

    /** Injeta texto/link formatado no campo ativo. */
    @ReactMethod
    fun insertText(text: String, promise: Promise) =
        withService(promise) { it.commitText(text) }

    @ReactMethod
    fun deleteBackward(promise: Promise) =
        withService(promise) { it.deleteBackward() }

    @ReactMethod
    fun sendEnter(promise: Promise) =
        withService(promise) { it.sendEnter() }

    /** { before: texto antes do cursor, inputType: tipo do campo (EditorInfo) } */
    @ReactMethod
    fun getInputContext(promise: Promise) =
        withService(promise) { it.inputContext() }

    /** Troca a palavra atual pela sugestão escolhida (apaga `count` e insere `text`). */
    @ReactMethod
    fun replaceTextBeforeCursor(count: Double, text: String, promise: Promise) =
        withService(promise) { it.replaceTextBeforeCursor(count.toInt(), text) }

    /** Alterna para o próximo teclado ou exibe o seletor de métodos de entrada */
    /** Vibração curta de "pegou o item" (arrastar os botões do menu). */
    @ReactMethod
    fun hapticLongPress(promise: Promise) =
        withService(promise) { it.hapticLongPress() }

    /** Tamanho do teclado: "normal", "tall" (intermediário, Atalhos) ou "expanded" (tela grande). */
    @ReactMethod
    fun setHeightMode(mode: String, promise: Promise) =
        withService(promise) {
            it.setHeightMode(
                when (mode) {
                    "expanded" -> CustomKeyboardService.HEIGHT_EXPANDED
                    "tall" -> CustomKeyboardService.HEIGHT_TALL
                    "translate" -> CustomKeyboardService.HEIGHT_TRANSLATE
                    else -> CustomKeyboardService.HEIGHT_NORMAL
                },
            )
        }

    /** O "voltar" do celular volta uma tela no teclado (true) ou fecha o teclado (false, o normal). */
    @ReactMethod
    fun setBackEnabled(enabled: Boolean) {
        UiThreadUtil.runOnUiThread { CustomKeyboardService.instance?.jsHandlesBack = enabled }
    }

    /** Teclado em tela grande (CRM) ou de volta ao tamanho normal. */
    @ReactMethod
    fun setExpanded(expanded: Boolean, promise: Promise) =
        withService(promise) { it.setExpanded(expanded) }

    @ReactMethod
    fun switchKeyboard(promise: Promise) {
        UiThreadUtil.runOnUiThread {
            val service = CustomKeyboardService.instance
            if (service != null) {
                try {
                    service.switchKeyboard()
                    promise.resolve(true)
                } catch (t: Throwable) {
                    val imm = reactApplicationContext.getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
                    imm?.showInputMethodPicker()
                    promise.resolve(true)
                }
            } else {
                val imm = reactApplicationContext.getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
                imm?.showInputMethodPicker()
                promise.resolve(true)
            }
        }
    }

    /** Abre o seletor nativo de teclados do Android */
    @ReactMethod
    fun openInputMethodPicker(promise: Promise) {
        UiThreadUtil.runOnUiThread {
            try {
                val imm = reactApplicationContext.getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
                imm?.showInputMethodPicker()
                promise.resolve(true)
            } catch (t: Throwable) {
                promise.reject("E_PICKER", t.message, t)
            }
        }
    }

    /**
     * Abre um link (ex.: https://wa.me/5511... para conversar com o cliente).
     * Pelo contexto do teclado visível: o Android deixa abrir mesmo com o app
     * KEYCON em segundo plano. O WhatsApp abre direto na conversa.
     */
    @ReactMethod
    fun openUrl(url: String, promise: Promise) {
        UiThreadUtil.runOnUiThread {
            try {
                val context = CustomKeyboardService.instance ?: reactApplicationContext
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(intent)
                promise.resolve(true)
            } catch (_: ActivityNotFoundException) {
                promise.reject("E_OPEN_URL", "Nenhum app encontrado para abrir o link.")
            } catch (t: Throwable) {
                promise.reject("E_OPEN_URL", t.message ?: "Não foi possível abrir o link.", t)
            }
        }
    }

    /** Abre o app KEYCON (usado pelo teclado quando não há login). */
    @ReactMethod
    fun openApp(promise: Promise) {
        UiThreadUtil.runOnUiThread {
            try {
                val ctx = reactApplicationContext
                val intent = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)
                    ?: return@runOnUiThread promise.reject("E_OPEN_APP", "App não encontrado.")
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                ctx.startActivity(intent)
                promise.resolve(true)
            } catch (t: Throwable) {
                promise.reject("E_OPEN_APP", t.message, t)
            }
        }
    }

    /** Abre a tela de configurações de teclado do Android */
    @ReactMethod
    fun openKeyboardSettings(promise: Promise) {
        UiThreadUtil.runOnUiThread {
            try {
                val intent = Intent(Settings.ACTION_INPUT_METHOD_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                reactApplicationContext.startActivity(intent)
                promise.resolve(true)
            } catch (t: Throwable) {
                promise.reject("E_SETTINGS", t.message, t)
            }
        }
    }

    /** Verifica se o KEYCON está ativado em 'Gerenciar Teclados' */
    @ReactMethod
    fun isKeyboardEnabled(promise: Promise) {
        try {
            val imm = reactApplicationContext.getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
            val enabledMethods = imm?.enabledInputMethodList ?: emptyList()
            val myPackageName = reactApplicationContext.packageName
            val isEnabled = enabledMethods.any { it.packageName == myPackageName }
            promise.resolve(isEnabled)
        } catch (t: Throwable) {
            promise.resolve(false)
        }
    }

    /** Verifica se o KEYCON é o teclado padrão/selecionado atualmente */
    @ReactMethod
    fun isKeyboardSelected(promise: Promise) {
        try {
            val defaultIme = Settings.Secure.getString(
                reactApplicationContext.contentResolver,
                Settings.Secure.DEFAULT_INPUT_METHOD
            )
            val myPackageName = reactApplicationContext.packageName
            val isSelected = defaultIme != null && defaultIme.contains(myPackageName)
            promise.resolve(isSelected)
        } catch (t: Throwable) {
            promise.resolve(false)
        }
    }

    /** Retorna o package do app em foco (ex.: "com.whatsapp"). */
    @ReactMethod
    fun getTargetApp(promise: Promise) =
        withService(promise) { it.targetPackage }

    @ReactMethod
    fun isKeyboardContext(promise: Promise) {
        promise.resolve(CustomKeyboardService.instance != null)
    }

    /** O JS avisa que a tela do teclado montou (usado no diagnóstico de carregamento). */
    @ReactMethod
    fun notifyReady() {
        UiThreadUtil.runOnUiThread { CustomKeyboardService.instance?.markJsReady() }
    }

    /** O JS reporta erros não tratados para aparecerem no diagnóstico do teclado. */
    @ReactMethod
    fun reportError(message: String) {
        CustomKeyboardService.lastJsError = message
        android.util.Log.e("KeyboardBridge", "Erro JS: $message")
    }

    // -----------------------------------------------------------------------
    // Envio de arquivos (fotos, vídeos e áudios)
    // -----------------------------------------------------------------------

    /** Altura exata do teclado em dp (barrinha de puxar, tradução que cresce); 0 = a do modo. */
    @ReactMethod
    fun setKeyboardHeight(dp: Double, promise: Promise) =
        withService(promise) { it.setCustomHeight(dp.toFloat()) }

    /** { normal, max } em dp: a altura do teclado de letras e a maior possível. */
    @ReactMethod
    fun getKeyboardHeights(promise: Promise) =
        withService(promise) {
            val (normal, max) = it.heightsDp()
            Arguments.createMap().apply {
                putDouble("normal", normal.toDouble())
                putDouble("max", max.toDouble())
            }
        }

    /**
     * Onde fica a faixa do corretor (em dp, relativo ao teclado) e a cor dela: as
     * sugestões do preenchimento automático aparecem ali. width 0 = sem faixa na tela.
     */
    @ReactMethod
    fun setAutofillArea(x: Double, y: Double, width: Double, height: Double, color: Double) {
        UiThreadUtil.runOnUiThread {
            val service = CustomKeyboardService.instance ?: return@runOnUiThread
            if (width <= 0 || height <= 0) {
                service.setAutofillArea(null, 0)
                return@runOnUiThread
            }
            val d = reactApplicationContext.resources.displayMetrics.density
            service.setAutofillArea(
                Rect((x * d).toInt(), (y * d).toInt(), ((x + width) * d).toInt(), ((y + height) * d).toInt()),
                color.toLong().toInt(),
            )
        }
    }

    /** Formatos de arquivo que o campo em foco aceita (tela de Diagnóstico). */
    @ReactMethod
    fun getContentMimeTypes(promise: Promise) =
        withService(promise) { Arguments.fromArray(it.acceptedContentMimeTypes()) }

    /**
     * Baixa a imagem e entrega direto na conversa.
     * Resolve "sent", "unsupported" (o campo não aceita esse formato) ou "failed".
     */
    @ReactMethod
    fun commitImage(url: String, description: String, promise: Promise) {
        UiThreadUtil.runOnUiThread {
            if (CustomKeyboardService.instance == null) {
                return@runOnUiThread promise.reject("E_IME_INACTIVE", "O teclado KEYCON não está ativo.")
            }
            downloads.execute {
                val media = try {
                    MediaFiles.download(reactApplicationContext, url)
                } catch (t: Throwable) {
                    promise.reject("E_DOWNLOAD", t.message ?: "Não foi possível baixar a foto.", t)
                    return@execute
                }
                if (!media.mimeType.startsWith("image/")) {
                    promise.reject("E_NOT_IMAGE", "O link não é de uma imagem (${media.mimeType}).")
                    return@execute
                }
                UiThreadUtil.runOnUiThread { commitWhenFieldReady(media, description, url, promise, COMMIT_RETRIES) }
            }
        }
    }

    /**
     * Logo depois da galeria/câmera fechar, o Android ainda está religando o
     * teclado ao campo da conversa e, por um instante, o campo parece não aceitar
     * nada: espera um pouco antes de dizer que o app não recebe fotos.
     */
    private fun commitWhenFieldReady(media: MediaFiles.Downloaded, description: String, url: String, promise: Promise, retries: Int) {
        val service = CustomKeyboardService.instance
            ?: return promise.reject("E_IME_INACTIVE", "O teclado foi fechado antes do envio.")
        val accepted = service.acceptedContentMimeTypes()
        if (!MediaFiles.acceptsAny(accepted, "image/")) {
            if (retries > 0) {
                UiThreadUtil.runOnUiThread({ commitWhenFieldReady(media, description, url, promise, retries - 1) }, COMMIT_RETRY_MS)
            } else {
                promise.resolve("unsupported")
            }
            return
        }
        // Formato que o campo não recebe (ex.: HEIC da câmera): converte fora da main thread
        downloads.execute {
            val image = runCatching { MediaFiles.imageFor(accepted, media) }.getOrNull()
                ?: return@execute promise.resolve("unsupported")
            UiThreadUtil.runOnUiThread {
                val current = CustomKeyboardService.instance
                    ?: return@runOnUiThread promise.reject("E_IME_INACTIVE", "O teclado foi fechado antes do envio.")
                try {
                    promise.resolve(if (current.commitImage(image, description, url)) "sent" else "failed")
                } catch (t: Throwable) {
                    promise.reject("E_COMMIT", t.message, t)
                }
            }
        }
    }

    /**
     * Baixa antes (para o cache) as fotos, vídeos e áudios do catálogo e dos
     * atalhos, para o envio ser instantâneo e funcionar com internet fraca.
     * No 4G (rede medida) pula os vídeos. Resolve com quantos ficaram prontos.
     */
    @ReactMethod
    fun prefetchMedia(urls: ReadableArray, promise: Promise) {
        val list = (0 until urls.size()).mapNotNull { urls.getString(it) }.distinct().take(MAX_PREFETCH)
        val ctx = reactApplicationContext
        val connectivity = ctx.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        val metered = connectivity?.isActiveNetworkMetered ?: true
        prefetches.execute {
            var ready = 0
            for (url in list) {
                if (MediaFiles.isCached(ctx, url)) {
                    ready++
                    continue
                }
                if (metered && MediaFiles.looksLikeVideo(url)) continue
                try {
                    MediaFiles.download(ctx, url)
                    ready++
                } catch (_: Throwable) {
                    // Link quebrado ou sem internet: tenta de novo no próximo uso
                }
            }
            promise.resolve(ready)
        }
    }

    /**
     * Baixa os arquivos e abre o compartilhamento do Android, priorizando o app
     * em foco (ex.: WhatsApp). Resolve "direct" ou "chooser".
     */
    @ReactMethod
    fun shareMedia(urls: ReadableArray, promise: Promise) = share(urls, null, promise)

    /**
     * Como shareMedia, com um texto de legenda junto da foto (ficha do
     * produto): no WhatsApp a foto e o texto vão numa mensagem só.
     */
    @ReactMethod
    fun shareWithCaption(urls: ReadableArray, caption: String, promise: Promise) = share(urls, caption, promise)

    private fun share(urls: ReadableArray, caption: String?, promise: Promise) {
        val list = (0 until urls.size()).mapNotNull { urls.getString(it) }
        if (list.isEmpty()) {
            promise.reject("E_EMPTY", "Nenhum arquivo para enviar.")
            return
        }
        downloads.execute {
            val files = try {
                list.map { MediaFiles.download(reactApplicationContext, it) }
            } catch (t: Throwable) {
                promise.reject("E_DOWNLOAD", t.message ?: "Não foi possível baixar o arquivo.", t)
                return@execute
            }
            UiThreadUtil.runOnUiThread {
                try {
                    val service = CustomKeyboardService.instance
                    val context = service ?: reactApplicationContext
                    promise.resolve(MediaFiles.share(context, files, service?.targetPackage, caption))
                } catch (t: Throwable) {
                    promise.reject("E_SHARE", t.message ?: "Não foi possível abrir o compartilhamento.", t)
                }
            }
        }
    }

    /**
     * Foto ou vídeo para a seção Arquivos, escolhido de dentro do teclado:
     * source = "gallery", "gallery-photo" (só fotos), "camera-photo",
     * "camera-video" ou "audio" (arquivos de áudio). Resolve com o
     * arquivo no cache ({ uri, name, mimeType, size, durationMs }) ou null se a
     * pessoa cancelar.
     */
    @ReactMethod
    fun pickMedia(source: String, promise: Promise) {
        UiThreadUtil.runOnUiThread {
            try {
                // Pelo contexto do teclado visível: o Android deixa abrir a tela mesmo com o app em segundo plano
                val context = CustomKeyboardService.instance ?: reactApplicationContext
                MediaPickActivity.start(context, source) { result ->
                    // A galeria/câmera fechou: o teclado volta sozinho (sem precisar tocar no campo)
                    CustomKeyboardService.instance?.showAgainSoon()
                    when (result) {
                        is MediaPickActivity.Result.Ok -> {
                            val p = result.picked
                            promise.resolve(Arguments.createMap().apply {
                                putString("uri", "file://${p.file.absolutePath}")
                                putString("name", p.name)
                                putString("mimeType", p.mimeType)
                                putDouble("size", p.file.length().toDouble())
                                p.durationMs?.let { putDouble("durationMs", it.toDouble()) }
                            })
                        }
                        is MediaPickActivity.Result.Cancelled -> promise.resolve(null)
                        is MediaPickActivity.Result.Error -> promise.reject("E_PICK", result.message)
                        is MediaPickActivity.Result.Permission -> promise.resolve(null)
                    }
                }
            } catch (t: Throwable) {
                promise.reject("E_PICK", t.message ?: "Não foi possível abrir a galeria.", t)
            }
        }
    }

    /**
     * Permissão do microfone pedida de dentro do teclado (o PermissionsAndroid
     * do React Native precisa de uma Activity, que o teclado não tem).
     * Resolve "granted", "denied" ou "blocked".
     */
    @ReactMethod
    fun requestMicPermission(promise: Promise) {
        UiThreadUtil.runOnUiThread {
            val context = CustomKeyboardService.instance ?: reactApplicationContext
            if (MediaPickActivity.hasMicPermission(context)) {
                promise.resolve("granted")
                return@runOnUiThread
            }
            try {
                MediaPickActivity.start(context, MediaPickActivity.SOURCE_MIC_PERMISSION) { result ->
                    CustomKeyboardService.instance?.showAgainSoon()
                    promise.resolve(if (result is MediaPickActivity.Result.Permission) result.state else "denied")
                }
            } catch (t: Throwable) {
                promise.reject("E_PERMISSION", t.message ?: "Não foi possível pedir a permissão do microfone.", t)
            }
        }
    }

    // Obrigatórios para NativeEventEmitter no RN ≥ 0.65
    @ReactMethod fun addListener(eventName: String) { /* no-op */ }
    @ReactMethod fun removeListeners(count: Double) { /* no-op */ }

    companion object {
        /** Arquivos pré-baixados por vez (o cache guarda até 150 MB). */
        private const val MAX_PREFETCH = 40
        /** Espera o teclado religar ao campo da conversa: até 4 x 300 ms. */
        private const val COMMIT_RETRIES = 4
        private const val COMMIT_RETRY_MS = 300L
    }
}

