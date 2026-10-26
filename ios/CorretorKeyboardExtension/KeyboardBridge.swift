import Foundation
// React Native: cabeçalhos pelo CorretorKeyboardExtension-Bridging-Header.h

/**
 * KeyboardBridge (iOS) — mesma API JS do módulo Android:
 *   insertText, deleteBackward, sendEnter, switchKeyboard, getTargetApp,
 *   isKeyboardContext + eventos onKeyboardShow / onKeyboardHide.
 */
@objc(KeyboardBridge)
final class KeyboardBridge: RCTEventEmitter {

    private static weak var current: KeyboardBridge?
    private var hasListeners = false

    override init() {
        super.init()
        KeyboardBridge.current = self
    }

    @objc static func requiresMainQueueSetup() -> Bool { true }
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
