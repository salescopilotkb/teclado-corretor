package com.corretorkeyboard.keyboard

import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Ditado por voz no teclado (Android): a pessoa fala e o texto vai para o campo da
 * conversa. Usa o reconhecimento de voz do próprio Android (SpeechRecognizer), com
 * preferência pelo modo sem internet quando o idioma está baixado no celular. O
 * KEYCON não grava nem guarda o áudio.
 *
 * Fica ouvindo frase após frase até a pessoa tocar em Parar (ou ficar em silêncio
 * duas vezes seguidas). Eventos para o JS ("onDictation"):
 *   { type: "listening" } · { type: "partial", text } · { type: "final", text }
 *   · { type: "stopped" } · { type: "error", code }
 */
class VoiceTypingModule(ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {

    override fun getName() = "KeyconVoiceTyping"

    private var recognizer: SpeechRecognizer? = null
    /** A pessoa quer continuar ditando (false depois de Parar). */
    private var active = false
    private var language = "pt-BR"
    /** Silêncios seguidos: no segundo, o ditado para sozinho. */
    private var silences = 0

    @ReactMethod
    fun isAvailable(promise: Promise) {
        val context = CustomKeyboardService.instance ?: reactApplicationContext
        promise.resolve(SpeechRecognizer.isRecognitionAvailable(context))
    }

    @ReactMethod
    fun start(lang: String, promise: Promise) {
        UiThreadUtil.runOnUiThread {
            try {
                language = lang
                active = true
                silences = 0
                listen()
                promise.resolve(true)
            } catch (t: Throwable) {
                active = false
                promise.reject("E_DICTATION", t.message ?: "Não foi possível começar o ditado.", t)
            }
        }
    }

    /** Parar: entrega o que já foi dito e não começa outra frase. */
    @ReactMethod
    fun stop() {
        UiThreadUtil.runOnUiThread {
            active = false
            recognizer?.stopListening()
            emit("stopped")
        }
    }

    /** Exigidos pelo NativeEventEmitter do JS. */
    @ReactMethod
    fun addListener(eventName: String) = Unit

    @ReactMethod
    fun removeListeners(count: Int) = Unit

    private fun listen() {
        val context = CustomKeyboardService.instance ?: reactApplicationContext
        val current = recognizer ?: SpeechRecognizer.createSpeechRecognizer(context).also {
            it.setRecognitionListener(listener)
            recognizer = it
        }
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, language)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, context.packageName)
        }
        current.startListening(intent)
    }

    private val listener = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) = emit("listening")
        override fun onBeginningOfSpeech() = Unit
        override fun onRmsChanged(rmsdB: Float) = Unit
        override fun onBufferReceived(buffer: ByteArray?) = Unit
        override fun onEndOfSpeech() = Unit
        override fun onEvent(eventType: Int, params: Bundle?) = Unit

        override fun onPartialResults(partialResults: Bundle?) {
            val text = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
            if (!text.isNullOrBlank()) emit("partial", text)
        }

        override fun onResults(results: Bundle?) {
            val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
            if (!text.isNullOrBlank()) {
                silences = 0
                emit("final", text)
            }
            // Próxima frase, até a pessoa tocar em Parar
            if (active) UiThreadUtil.runOnUiThread { listenAgain() }
        }

        override fun onError(error: Int) {
            val silence = error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT
            if (active && silence && ++silences < 2) {
                UiThreadUtil.runOnUiThread { listenAgain() }
                return
            }
            val wasActive = active
            active = false
            if (silence || !wasActive) emit("stopped") else emitError(error)
        }
    }

    private fun listenAgain() {
        if (!active) return
        try {
            listen()
        } catch (_: Throwable) {
            active = false
            emit("stopped")
        }
    }

    private fun emit(type: String, text: String? = null) {
        val map = Arguments.createMap().apply {
            putString("type", type)
            if (text != null) putString("text", text)
        }
        send(map)
    }

    private fun emitError(code: Int) {
        val map = Arguments.createMap().apply {
            putString("type", "error")
            putInt("code", code)
        }
        send(map)
    }

    private fun send(map: com.facebook.react.bridge.WritableMap) {
        try {
            if (!reactApplicationContext.hasActiveReactInstance()) return
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("onDictation", map)
        } catch (_: Throwable) {
        }
    }

    override fun invalidate() {
        UiThreadUtil.runOnUiThread {
            recognizer?.destroy()
            recognizer = null
        }
        super.invalidate()
    }
}
