import UIKit
// React Native: cabeçalhos pelo CorretorKeyboardExtension-Bridging-Header.h

/**
 * KeyboardViewController — iOS Custom Keyboard Extension
 * ---------------------------------------------------------------------------
 * Equivalente iOS do CustomKeyboardService. Roda em um PROCESSO SEPARADO do
 * app principal (extensão), portanto:
 *   • Precisa de seu próprio RCTBridge (o JS bundle é carregado aqui também).
 *   • Dados do app são compartilhados via App Group (MMKV com AppGroup).
 *   • Info.plist da extensão: RequestsOpenAccess = YES (rede + clipboard).
 *
 * ⚠️ Limite de memória de extensões de teclado (~50–70 MB). Use Hermes,
 *    bundle enxuto (sem libs de mapa/vídeo) e evite imagens grandes.
 */
final class KeyboardViewController: UIInputViewController {

    /// Usado pelo KeyboardBridge (NativeModule) para chegar ao textDocumentProxy.
    static weak var shared: KeyboardViewController?

    private var bridge: RCTBridge?
    private var heightConstraint: NSLayoutConstraint?
    private let normalHeight: CGFloat = 320
    /// Teclado expandido (CRM em tela grande), pedido pelo JS via KeyboardBridge.setExpanded.
    private var expanded = false
    /// Fração da tela no modo expandido: deixa uma faixa do app visível em cima.
    private let expandedScreenFraction: CGFloat = 0.8

    private var keyboardHeight: CGFloat {
        guard expanded else { return normalHeight }
        return max(normalHeight, UIScreen.main.bounds.height * expandedScreenFraction)
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        KeyboardViewController.shared = self

        guard let bridge = RCTBridge(delegate: self, launchOptions: nil) else { return }
        self.bridge = bridge

        let rootView = RCTRootView(
            bridge: bridge,
            moduleName: "CorretorKeyboard",
            initialProperties: [
                "platform": "ios-extension",
                "hasFullAccess": hasFullAccess
            ]
        )
        rootView.backgroundColor = .clear
        rootView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(rootView)

        NSLayoutConstraint.activate([
            rootView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            rootView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            rootView.topAnchor.constraint(equalTo: view.topAnchor),
            rootView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        // Prioridade 999 evita conflito com a constraint de altura do sistema.
        let h = view.heightAnchor.constraint(equalToConstant: keyboardHeight)
        h.priority = UILayoutPriority(999)
        h.isActive = true
        heightConstraint = h
    }

    override func updateViewConstraints() {
        super.updateViewConstraints()
        if heightConstraint == nil {
            let h = view.heightAnchor.constraint(equalToConstant: keyboardHeight)
            h.priority = UILayoutPriority(999)
            h.isActive = true
            heightConstraint = h
        } else {
            heightConstraint?.constant = keyboardHeight
        }
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        KeyboardBridge.emit("onKeyboardShow", body: [
            "targetPackage": NSNull(), // iOS não expõe o app hospedeiro
            "restarting": false
        ])
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        // Ao reabrir, o teclado volta no tamanho normal
        if expanded { setExpanded(false) }
        KeyboardBridge.emit("onKeyboardHide", body: [:])
    }

    // MARK: - (B) Interação com o campo de texto — textDocumentProxy
    // UITextDocumentProxy é o equivalente iOS do InputConnection.

    func insert(_ text: String) { textDocumentProxy.insertText(text) }
    func deleteBackward() { textDocumentProxy.deleteBackward() }
    func sendEnter() { textDocumentProxy.insertText("\n") }
    func switchKeyboard() { advanceToNextInputMode() }

    /// Expande o teclado para quase a tela toda (ou volta ao normal).
    func setExpanded(_ value: Bool) {
        expanded = value
        heightConstraint?.constant = keyboardHeight
        view.setNeedsLayout()
        view.layoutIfNeeded()
    }

    /// Texto antes do cursor + tipo do campo (mesmos códigos do Android: email,
    /// link e senha não recebem maiúscula automática nem sugestões).
    func inputContext() -> [String: Any] {
        let proxy = textDocumentProxy
        var inputType = 1 // texto
        switch proxy.keyboardType {
        case .emailAddress?: inputType = 0x21
        case .URL?, .webSearch?: inputType = 0x11
        case .numberPad?, .decimalPad?, .phonePad?, .numbersAndPunctuation?: inputType = 2
        default: break
        }
        if proxy.isSecureTextEntry == true { inputType = 0x81 }
        let before = proxy.documentContextBeforeInput ?? ""
        return ["before": String(before.suffix(200)), "inputType": inputType]
    }

    /// Troca os `count` caracteres antes do cursor por `text` (sugestões).
    func replaceTextBeforeCursor(_ count: Int, _ text: String) {
        for _ in 0..<max(0, count) { textDocumentProxy.deleteBackward() }
        textDocumentProxy.insertText(text)
    }

    // O app mudou o texto ou o cursor: o JS confere o contexto da digitação
    override func textDidChange(_ textInput: UITextInput?) {
        super.textDidChange(textInput)
        KeyboardBridge.emit("onSelectionChange", body: [:])
    }

    override func selectionDidChange(_ textInput: UITextInput?) {
        super.selectionDidChange(textInput)
        KeyboardBridge.emit("onSelectionChange", body: [:])
    }
}

// MARK: - RCTBridgeDelegate
extension KeyboardViewController: RCTBridgeDelegate {
    func sourceURL(for bridge: RCTBridge) -> URL? {
        #if DEBUG
        return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
        #else
        return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
        #endif
    }
}
