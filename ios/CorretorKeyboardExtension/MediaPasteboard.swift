import UIKit
import UniformTypeIdentifiers

/**
 * MediaPasteboard — envio de fotos, vídeos e áudios pelo teclado do iPhone.
 * ---------------------------------------------------------------------------
 * A Apple não deixa um teclado colocar imagem no campo da conversa nem abrir
 * o compartilhamento. A saída: o teclado baixa o arquivo e COPIA (área de
 * transferência); a pessoa toca e segura no campo e escolhe "Colar".
 *
 * Precisa do Acesso Total (internet + área de transferência). Arquivos muito
 * grandes não são copiados: a extensão tem pouca memória (~50–70 MB).
 */
enum MediaPasteboard {

    /// Maior arquivo que o teclado copia (o resto vai pelo app).
    static let maxFileBytes = 25 * 1024 * 1024
    static let maxTotalBytes = 40 * 1024 * 1024

    enum Failure: LocalizedError {
        case noFullAccess
        case badUrl
        case download
        case tooBig

        var errorDescription: String? {
            switch self {
            case .noFullAccess:
                return "Ligue o Acesso Total do KEYCON (Ajustes › Geral › Teclado › Teclados › KEYCON) para enviar arquivos pelo teclado."
            case .badUrl: return "Link do arquivo inválido."
            case .download: return "Não foi possível baixar o arquivo. Confira a internet."
            case .tooBig: return "Arquivo grande demais para enviar pelo teclado. Envie pelo app KEYCON."
            }
        }
    }

    /// Baixa os arquivos e põe todos na área de transferência (um item por arquivo).
    static func copy(_ urls: [String], completion: @escaping (Result<Void, Error>) -> Void) {
        let parsed = urls.compactMap { URL(string: $0) }
        guard !parsed.isEmpty, parsed.count == urls.count else {
            completion(.failure(Failure.badUrl))
            return
        }

        var items = [[String: Any]](repeating: [:], count: parsed.count)
        var failure: Error?
        var total = 0
        let lock = NSLock()
        let group = DispatchGroup()

        for (index, url) in parsed.enumerated() {
            group.enter()
            URLSession.shared.downloadTask(with: url) { location, response, error in
                defer { group.leave() }
                let result = item(from: location, response: response, error: error, url: url)
                lock.lock()
                defer { lock.unlock() }
                switch result {
                case .success(let (item, bytes)):
                    total += bytes
                    if total > maxTotalBytes { failure = failure ?? Failure.tooBig }
                    items[index] = item
                case .failure(let e):
                    failure = failure ?? e
                }
            }.resume()
        }

        group.notify(queue: .main) {
            if let failure = failure {
                completion(.failure(failure))
                return
            }
            UIPasteboard.general.setItems(items)
            completion(.success(()))
        }
    }

    /// Um item da área de transferência: { tipo do arquivo: conteúdo }.
    private static func item(from location: URL?, response: URLResponse?, error: Error?, url: URL)
        -> Result<([String: Any], Int), Error>
    {
        guard error == nil, let location = location,
              (response as? HTTPURLResponse).map({ (200..<300).contains($0.statusCode) }) ?? true
        else { return .failure(Failure.download) }

        let size = (try? FileManager.default.attributesOfItem(atPath: location.path)[.size] as? Int) ?? 0
        if size > maxFileBytes { return .failure(Failure.tooBig) }
        guard let data = try? Data(contentsOf: location), !data.isEmpty else { return .failure(Failure.download) }

        let type = utType(mime: response?.mimeType, url: url)
        // Foto num formato que os apps não colam (ex.: WebP): vai como JPEG
        if type.conforms(to: .image), type != .jpeg, type != .png, type != .gif {
            if let jpeg = UIImage(data: data)?.jpegData(compressionQuality: 0.9) {
                return .success(([UTType.jpeg.identifier: jpeg], jpeg.count))
            }
        }
        return .success(([type.identifier: data], data.count))
    }

    private static func utType(mime: String?, url: URL) -> UTType {
        if let mime = mime, mime != "application/octet-stream", let type = UTType(mimeType: mime) {
            return type
        }
        if let type = UTType(filenameExtension: url.pathExtension.lowercased()) { return type }
        return .data
    }
}
