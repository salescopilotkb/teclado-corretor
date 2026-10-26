package com.corretorkeyboard.keyboard

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.common.model.RemoteModelManager
import com.google.mlkit.nl.translate.TranslateLanguage
import com.google.mlkit.nl.translate.TranslateRemoteModel
import com.google.mlkit.nl.translate.Translation
import com.google.mlkit.nl.translate.Translator
import com.google.mlkit.nl.translate.TranslatorOptions

/**
 * TranslatorModule
 * ---------------------------------------------------------------------------
 * Tradução do teclado (botão "Traduzir" do menu), exposta ao JS como
 * `NativeModules.KeyconTranslator`. Usa o Google ML Kit Translation: a
 * tradução roda NO APARELHO (o texto não sai do celular, funciona sem
 * internet), sem chave de API. Cada idioma é baixado uma vez (~30 MB).
 */
class TranslatorModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "KeyconTranslator"

    /** Um tradutor por par de idiomas (abrir um é caro). */
    private val translators = HashMap<String, Translator>()

    private fun languageOf(code: String): String =
        TranslateLanguage.fromLanguageTag(code) ?: throw IllegalArgumentException("Idioma não suportado: $code")

    private fun translatorFor(source: String, target: String): Translator =
        translators.getOrPut("$source>$target") {
            Translation.getClient(
                TranslatorOptions.Builder()
                    .setSourceLanguage(languageOf(source))
                    .setTargetLanguage(languageOf(target))
                    .build()
            )
        }

    /** Os dois idiomas já estão no aparelho (tradução instantânea, sem internet)? */
    @ReactMethod
    fun isReady(source: String, target: String, promise: Promise) {
        try {
            val manager = RemoteModelManager.getInstance()
            val models = listOf(source, target).filter { it != "en" } // o inglês já vem junto
                .map { TranslateRemoteModel.Builder(languageOf(it)).build() }
            if (models.isEmpty()) {
                promise.resolve(true)
                return
            }
            var pending = models.size
            var allReady = true
            for (model in models) {
                manager.isModelDownloaded(model)
                    .addOnSuccessListener { ready ->
                        if (!ready) allReady = false
                        if (--pending == 0) promise.resolve(allReady)
                    }
                    .addOnFailureListener { promise.resolve(false) }
            }
        } catch (t: Throwable) {
            promise.reject("E_TRANSLATE", t.message ?: "Idioma não suportado.", t)
        }
    }

    /** Traduz (baixa os idiomas antes, se ainda não estiverem no aparelho). */
    @ReactMethod
    fun translate(text: String, source: String, target: String, promise: Promise) {
        if (text.isBlank() || source == target) {
            promise.resolve(text)
            return
        }
        try {
            val translator = translatorFor(source, target)
            translator.downloadModelIfNeeded(DownloadConditions.Builder().build())
                .continueWithTask { task ->
                    if (!task.isSuccessful) throw task.exception ?: Exception("download")
                    translator.translate(text)
                }
                .addOnSuccessListener { promise.resolve(it) }
                .addOnFailureListener {
                    promise.reject(
                        "E_TRANSLATE",
                        "Não foi possível traduzir. Na primeira vez, o tradutor do idioma precisa ser baixado (internet).",
                        it,
                    )
                }
        } catch (t: Throwable) {
            promise.reject("E_TRANSLATE", t.message ?: "Não foi possível traduzir.", t)
        }
    }

    override fun invalidate() {
        translators.values.forEach { it.close() }
        translators.clear()
        super.invalidate()
    }
}
