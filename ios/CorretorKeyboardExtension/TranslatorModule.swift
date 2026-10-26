import Foundation
import MLKitTranslate

/**
 * TranslatorModule (iOS)
 * ---------------------------------------------------------------------------
 * Tradução do teclado (botão "Traduzir" do menu), exposta ao JS como
 * `NativeModules.KeyconTranslator` — mesma API do TranslatorModule.kt. Usa o
 * Google ML Kit Translation: a tradução roda NO APARELHO (o texto não sai do
 * celular, funciona sem internet), sem chave de API. Cada idioma é baixado
 * uma vez (~30 MB) — no iPhone isso precisa do Acesso Total (internet).
 *
 * Só existe no teclado (a tradução é usada no painel do teclado).
 */
@objc(KeyconTranslator)
final class TranslatorModule: NSObject {

    @objc static func requiresMainQueueSetup() -> Bool { false }

    /// Um tradutor por par de idiomas (abrir um é caro).
    private var translators: [String: Translator] = [:]
    private let lock = NSLock()

    private enum Failure: LocalizedError {
        case unsupported(String)
        var errorDescription: String? {
            switch self {
            case .unsupported(let code): return "Idioma não suportado: \(code)"
            }
        }
    }

    private func language(_ code: String) throws -> TranslateLanguage {
        let language = TranslateLanguage(rawValue: code)
        guard TranslateLanguage.allLanguages().contains(language) else { throw Failure.unsupported(code) }
        return language
    }

    private func translator(_ source: String, _ target: String) throws -> Translator {
        let key = "\(source)>\(target)"
        lock.lock()
        defer { lock.unlock() }
        if let cached = translators[key] { return cached }
        let options = TranslatorOptions(sourceLanguage: try language(source), targetLanguage: try language(target))
        let created = Translator.translator(options: options)
        translators[key] = created
        return created
    }

    /// Os dois idiomas já estão no aparelho (tradução instantânea, sem internet)?
    @objc func isReady(_ source: String,
                       target: String,
                       resolver resolve: @escaping RCTPromiseResolveBlock,
                       rejecter reject: @escaping RCTPromiseRejectBlock) {
        do {
            let manager = ModelManager.modelManager()
            // O inglês já vem junto
            let ready = try [source, target].filter { $0 != "en" }.allSatisfy { code in
                manager.isModelDownloaded(TranslateRemoteModel.translateRemoteModel(language: try language(code)))
            }
            resolve(ready)
        } catch {
            reject("E_TRANSLATE", error.localizedDescription, error)
        }
    }

    /// Traduz (baixa os idiomas antes, se ainda não estiverem no aparelho).
    @objc func translate(_ text: String,
                         source: String,
                         target: String,
                         resolver resolve: @escaping RCTPromiseResolveBlock,
                         rejecter reject: @escaping RCTPromiseRejectBlock) {
        if text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || source == target {
            resolve(text)
            return
        }
        let translator: Translator
        do {
            translator = try self.translator(source, target)
        } catch {
            reject("E_TRANSLATE", error.localizedDescription, error)
            return
        }
        let conditions = ModelDownloadConditions(allowsCellularAccess: true, allowsBackgroundDownloading: true)
        translator.downloadModelIfNeeded(with: conditions) { error in
            if let error = error {
                reject(
                    "E_TRANSLATE",
                    "Não foi possível traduzir. Na primeira vez, o tradutor do idioma precisa ser baixado (internet).",
                    error
                )
                return
            }
            translator.translate(text) { translated, error in
                if let translated = translated, error == nil {
                    resolve(translated)
                } else {
                    reject("E_TRANSLATE", "Não foi possível traduzir.", error)
                }
            }
        }
    }
}
