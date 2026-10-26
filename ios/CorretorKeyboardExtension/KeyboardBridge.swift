import Foundation
// React Native: cabeçalhos pelo CorretorKeyboardExtension-Bridging-Header.h

/**
 * KeyboardBridge (iOS) — mesma API JS do módulo Android:
 *   insertText, deleteBackward, sendEnter, switchKeyboard, getTargetApp,
 *   isKeyboardContext + eventos onKeyboardShow / onKeyboardHide.
 *
 * Diferenças do iPhone (regras da Apple para teclados):
 *   • Fotos, vídeos e áudios não entram direto na conversa: commitImage,
 *     shareMedia e shareWithCaption COPIAM o arquivo e respondem "copied";
 *     o JS pede para a pessoa tocar e segurar no campo e escolher Colar.
 *   • Não há galeria, câmera, microfone nem abrir outro app (pickMedia,
 *     requestMicPermission, openUrl e openApp não existem aqui).
 *   • hasFullAccess: sem o Acesso Total não há internet, dados do app
 *     (App Group), área de transferência nem vibração.
 */
@objc(KeyboardBridge)
final class KeyboardBridge: RCTEventEmitter {

    private static weak var current: KeyboardBridge?
    private var hasListeners = false

    override init() {
        super.init()
        KeyboardBridge.current = self
    }

    override static func requiresMainQueueSetup() -> Bool { true }
    override func supportedEvents() -> [String]! { ["onKeyboardShow", "onKeyboardHide", "onSelectionChange"] }
    override func startObserving() { hasListeners = true }
    override func stopObserving() { hasListeners = false }

    static func emit(_ name: String, body: [String: Any]) {
        guard let module = current, module.hasListeners else { return }
        module.sendEvent(withName: name, body: body)
    }

    private func onMain(_ resolve: @escaping RCTPromiseResolveBlock,
                        _ reject: @escaping RCTPromiseRejectBlock,
                        _ block: @escaping (KeyboardViewController) -> Any?) {
        DispatchQueue.main.async {
            guard let vc = KeyboardViewController.shared else {
                reject("E_IME_INACTIVE", "O teclado KEYCON não está ativo.", nil)
                return
            }
            resolve(block(vc))
        }
    }

    @objc func insertText(_ text: String,
                          resolver resolve: @escaping RCTPromiseResolveBlock,
                          rejecter reject: @escaping RCTPromiseRejectBlock) {
        onMain(resolve, reject) { $0.insert(text); return true }
    }

    @objc func deleteBackward(_ resolve: @escaping RCTPromiseResolveBlock,
                              rejecter reject: @escaping RCTPromiseRejectBlock) {
        onMain(resolve, reject) { $0.deleteBackward(); return true }
    }

    @objc func sendEnter(_ resolve: @escaping RCTPromiseResolveBlock,
                         rejecter reject: @escaping RCTPromiseRejectBlock) {
        onMain(resolve, reject) { $0.sendEnter(); return true }
    }

    @objc func getInputContext(_ resolve: @escaping RCTPromiseResolveBlock,
                               rejecter reject: @escaping RCTPromiseRejectBlock) {
        onMain(resolve, reject) { $0.inputContext() }
    }

    @objc func replaceTextBeforeCursor(_ count: NSNumber,
                                       text: String,
                                       resolver resolve: @escaping RCTPromiseResolveBlock,
                                       rejecter reject: @escaping RCTPromiseRejectBlock) {
        onMain(resolve, reject) { $0.replaceTextBeforeCursor(count.intValue, text); return true }
    }

    @objc func setExpanded(_ expanded: Bool,
                           resolver resolve: @escaping RCTPromiseResolveBlock,
                           rejecter reject: @escaping RCTPromiseRejectBlock) {
        onMain(resolve, reject) { $0.setExpanded(expanded); return true }
    }

    @objc func setHeightMode(_ mode: String,
                             resolver resolve: @escaping RCTPromiseResolveBlock,
                             rejecter reject: @escaping RCTPromiseRejectBlock) {
        onMain(resolve, reject) { $0.setHeightMode(KeyboardViewController.HeightMode(rawValue: mode) ?? .normal); return true }
    }

    @objc func hapticLongPress(_ resolve: @escaping RCTPromiseResolveBlock,
                               rejecter reject: @escaping RCTPromiseRejectBlock) {
        onMain(resolve, reject) { $0.hapticLongPress(); return true }
    }

    @objc func hasFullAccess(_ resolve: @escaping RCTPromiseResolveBlock,
                             rejecter reject: @escaping RCTPromiseRejectBlock) {
        onMain(resolve, reject) { $0.hasFullAccess }
    }

    // MARK: - Fotos, vídeos e áudios: copiar para colar

    /// Copia os arquivos e responde "copied" (ou rejeita com o motivo em português).
    private func copyMedia(_ urls: [String],
                           caption: String?,
                           _ resolve: @escaping RCTPromiseResolveBlock,
                           _ reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            guard let vc = KeyboardViewController.shared else {
                reject("E_IME_INACTIVE", "O teclado KEYCON não está ativo.", nil)
                return
            }
            guard vc.hasFullAccess else {
                reject("E_FULL_ACCESS", MediaPasteboard.Failure.noFullAccess.errorDescription, nil)
                return
            }
            MediaPasteboard.copy(urls) { result in
                switch result {
                case .success:
                    // Ficha do produto: o texto entra no campo; a foto vai copiada para colar junto
                    if let caption = caption, !caption.isEmpty { vc.insert(caption) }
                    resolve("copied")
                case .failure(let error):
                    reject("E_COPY", error.localizedDescription, error)
                }
            }
        }
    }

    @objc func commitImage(_ url: String,
                           description: String,
                           resolver resolve: @escaping RCTPromiseResolveBlock,
                           rejecter reject: @escaping RCTPromiseRejectBlock) {
        copyMedia([url], caption: nil, resolve, reject)
    }

    @objc func shareMedia(_ urls: [String],
                          resolver resolve: @escaping RCTPromiseResolveBlock,
                          rejecter reject: @escaping RCTPromiseRejectBlock) {
        copyMedia(urls, caption: nil, resolve, reject)
    }

    @objc func shareWithCaption(_ urls: [String],
                                caption: String,
                                resolver resolve: @escaping RCTPromiseResolveBlock,
                                rejecter reject: @escaping RCTPromiseRejectBlock) {
        copyMedia(urls, caption: caption, resolve, reject)
    }

    @objc func switchKeyboard(_ resolve: @escaping RCTPromiseResolveBlock,
                              rejecter reject: @escaping RCTPromiseRejectBlock) {
        onMain(resolve, reject) { $0.switchKeyboard(); return true }
    }

    @objc func getTargetApp(_ resolve: @escaping RCTPromiseResolveBlock,
                            rejecter reject: @escaping RCTPromiseRejectBlock) {
        resolve(nil)
    }

    @objc func isKeyboardContext(_ resolve: @escaping RCTPromiseResolveBlock,
                                 rejecter reject: @escaping RCTPromiseRejectBlock) {
        resolve(KeyboardViewController.shared != nil)
    }

    @objc func isKeyboardEnabled(_ resolve: @escaping RCTPromiseResolveBlock,
                                 rejecter reject: @escaping RCTPromiseRejectBlock) {
        resolve(false)
    }

    @objc func isKeyboardSelected(_ resolve: @escaping RCTPromiseResolveBlock,
                                  rejecter reject: @escaping RCTPromiseRejectBlock) {
        resolve(KeyboardViewController.shared != nil)
    }

    @objc func openInputMethodPicker(_ resolve: @escaping RCTPromiseResolveBlock,
                                     rejecter reject: @escaping RCTPromiseRejectBlock) {
        resolve(false)
    }

    @objc func openKeyboardSettings(_ resolve: @escaping RCTPromiseResolveBlock,
                                    rejecter reject: @escaping RCTPromiseRejectBlock) {
        resolve(false)
    }
}
