package com.corretorkeyboard.keyboard

import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipDescription
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.webkit.MimeTypeMap
import androidx.core.content.FileProvider
import java.io.File
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/**
 * MediaFiles
 * ---------------------------------------------------------------------------
 * Baixa fotos, vídeos e áudios do servidor para o cache do app e os expõe como
 * content:// (FileProvider). É o formato exigido para entregar um arquivo a
 * outro app — tanto pelo teclado (commitContent) quanto pelo compartilhamento.
 *
 * Os arquivos ficam em cache/keyboard_media e são reaproveitados: o segundo
 * envio da mesma foto não baixa de novo.
 */
object MediaFiles {
    private const val DIR = "keyboard_media"
    private const val MAX_BYTES = 50L * 1024 * 1024
    private const val MAX_CACHE_BYTES = 150L * 1024 * 1024
    private const val MAX_REDIRECTS = 5

    data class Downloaded(val file: File, val mimeType: String)

    /** Erro com mensagem pronta para mostrar ao usuário. */
    class MediaException(message: String) : IOException(message)

    private fun authority(context: Context) = "${context.packageName}.keyboardfiles"

    fun uriFor(context: Context, file: File): Uri =
        FileProvider.getUriForFile(context, authority(context), file)

    /** O campo de texto aceita esse tipo? (respeita curingas como "image/ *") */
    fun accepts(acceptedMimeTypes: Array<String>, mimeType: String): Boolean =
        acceptedMimeTypes.any { ClipDescription.compareMimeTypes(mimeType, it) }

    /** O campo aceita algum arquivo cujo tipo começa com o prefixo (ex.: "image/")? */
    fun acceptsAny(acceptedMimeTypes: Array<String>, prefix: String): Boolean =
        acceptedMimeTypes.any { it == "*/*" || it.startsWith(prefix) }

    /**
     * A foto num formato que o campo aceita. Fotos da câmera costumam vir em
     * HEIC ou WEBP, e muitos apps (ex.: WhatsApp) só recebem pelo teclado
     * JPEG/PNG/GIF: nesse caso converte para JPEG (ou PNG). null = o campo não
     * aceita nenhuma foto, ou a foto não abriu.
     * Lê e grava arquivo: chamar FORA da main thread.
     */
    fun imageFor(acceptedMimeTypes: Array<String>, media: Downloaded): Downloaded? {
        if (accepts(acceptedMimeTypes, media.mimeType)) return media
        val target = listOf("image/jpeg", "image/png").firstOrNull { accepts(acceptedMimeTypes, it) } ?: return null
        val out = File(media.file.parentFile, "conv-${media.file.nameWithoutExtension}.${if (target == "image/png") "png" else "jpg"}")
        if (out.exists() && out.length() > 0) {
            out.setLastModified(System.currentTimeMillis())
            return Downloaded(out, target)
        }
        val bitmap = BitmapFactory.decodeFile(media.file.absolutePath) ?: return null
        try {
            val format = if (target == "image/png") Bitmap.CompressFormat.PNG else Bitmap.CompressFormat.JPEG
            out.outputStream().use { bitmap.compress(format, 90, it) }
        } finally {
            bitmap.recycle()
        }
        return Downloaded(out, target)
    }

    /**
     * Baixa (ou reaproveita do cache) o arquivo do link.
     * Faz rede: chamar FORA da main thread.
     */
    @Throws(IOException::class)
    fun download(context: Context, url: String): Downloaded {
        val dir = File(context.cacheDir, DIR).apply { mkdirs() }
        val key = sha1(url)

        dir.listFiles { f -> f.name.startsWith("$key.") && !f.name.endsWith(".tmp") }
            ?.firstOrNull()
            ?.let { cached ->
                val mime = mimeFromExtension(cached.extension)
                if (mime != null) {
                    cached.setLastModified(System.currentTimeMillis())
                    return Downloaded(cached, mime)
                }
            }

        var current = URL(url)
        for (attempt in 0 until MAX_REDIRECTS) {
            val conn = current.openConnection() as HttpURLConnection
            conn.connectTimeout = 15_000
            conn.readTimeout = 30_000
            // Seguimos os redirecionamentos manualmente para aceitar http → https
            conn.instanceFollowRedirects = false
            try {
                val code = conn.responseCode
                if (code in 300..399) {
                    val location = conn.getHeaderField("Location")
                        ?: throw MediaException("O servidor redirecionou sem informar o destino.")
                    current = URL(current, location)
                    continue
                }
                if (code !in 200..299) throw MediaException("O servidor respondeu com erro $code.")

                val mime = resolveMimeType(conn.contentType, current.toString())
                    ?: throw MediaException(
                        "O link não aponta direto para uma foto, vídeo ou áudio " +
                            "(recebido: ${conn.contentType ?: "desconhecido"})."
                    )
                if (conn.contentLengthLong > MAX_BYTES) throw MediaException("Arquivo maior que 50 MB.")

                val ext = MimeTypeMap.getSingleton().getExtensionFromMimeType(mime) ?: "bin"
                // Temporário exclusivo: o pré-download e um envio podem baixar o mesmo link juntos
                val tmp = File(dir, "$key.${Thread.currentThread().id}-${System.nanoTime()}.tmp")
                conn.inputStream.use { input -> tmp.outputStream().use { out -> copyLimited(input, out) } }
                val target = File(dir, "$key.$ext")
                if (!tmp.renameTo(target)) {
                    tmp.delete()
                    // Outro download do mesmo link terminou antes: usa o dele
                    if (!target.exists()) throw IOException("Não foi possível salvar o arquivo.")
                }

                trimCache(dir)
                return Downloaded(target, mime)
            } finally {
                conn.disconnect()
            }
        }
        throw MediaException("Redirecionamentos demais ao baixar o arquivo.")
    }

    /**
     * Abre o compartilhamento do Android com os arquivos baixados. Tenta primeiro
     * o app em foco (ex.: WhatsApp); se ele não aceitar, mostra a lista de apps.
     * Retorna "direct" ou "chooser".
     */
    fun share(context: Context, files: List<Downloaded>, preferredPackage: String?, caption: String? = null): String {
        val uris = ArrayList(files.map { uriFor(context, it.file) })
        val intent = if (uris.size == 1) {
            Intent(Intent.ACTION_SEND).putExtra(Intent.EXTRA_STREAM, uris[0])
        } else {
            Intent(Intent.ACTION_SEND_MULTIPLE).putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
        }
        // Legenda: o WhatsApp manda a foto e o texto juntos, numa mensagem só
        if (!caption.isNullOrEmpty()) intent.putExtra(Intent.EXTRA_TEXT, caption)
        intent.type = commonMimeType(files.map { it.mimeType })
        // ClipData garante a permissão de leitura de TODOS os arquivos para o app de destino
        intent.clipData = ClipData.newRawUri("", uris[0]).apply {
            uris.drop(1).forEach { addItem(ClipData.Item(it)) }
        }
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)

        if (!preferredPackage.isNullOrEmpty() && preferredPackage != context.packageName) {
            try {
                context.startActivity(Intent(intent).setPackage(preferredPackage))
                return "direct"
            } catch (_: ActivityNotFoundException) {
                // O app em foco não recebe esse tipo de arquivo: cai na lista de apps
            }
        }
        context.startActivity(
            Intent.createChooser(intent, "Enviar com").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
        return "chooser"
    }

    /** Já está no cache (o envio vai ser instantâneo)? */
    fun isCached(context: Context, url: String): Boolean {
        val dir = File(context.cacheDir, DIR)
        val key = sha1(url)
        return dir.listFiles { f -> f.name.startsWith("$key.") && !f.name.endsWith(".tmp") }?.isNotEmpty() == true
    }

    /** O link parece de vídeo (pela extensão)? Vídeos não são pré-baixados no 4G. */
    fun looksLikeVideo(url: String): Boolean {
        val ext = MimeTypeMap.getFileExtensionFromUrl(url)
        return !ext.isNullOrEmpty() && mimeFromExtension(ext)?.startsWith("video/") == true
    }

    // -----------------------------------------------------------------------

    private fun isMedia(mime: String) =
        mime.startsWith("image/") || mime.startsWith("video/") || mime.startsWith("audio/")

    private fun mimeFromExtension(ext: String): String? =
        MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext.lowercase())?.takeIf { isMedia(it) }

    /** Usa o Content-Type do servidor; se for genérico, tenta pela extensão do link. */
    private fun resolveMimeType(contentType: String?, url: String): String? {
        val fromHeader = contentType?.substringBefore(';')?.trim()?.lowercase().orEmpty()
            // "image/jpg" não é um tipo oficial: o campo da conversa só reconhece "image/jpeg"
            .let { if (it == "image/jpg") "image/jpeg" else it }
        if (isMedia(fromHeader)) return fromHeader
        val ext = MimeTypeMap.getFileExtensionFromUrl(url)
        return if (ext.isNullOrEmpty()) null else mimeFromExtension(ext)
    }

    private fun commonMimeType(types: List<String>): String {
        if (types.distinct().size == 1) return types[0]
        val top = types.map { it.substringBefore('/') }.distinct()
        return if (top.size == 1) "${top[0]}/*" else "*/*"
    }

    private fun copyLimited(input: InputStream, out: OutputStream) {
        val buffer = ByteArray(64 * 1024)
        var total = 0L
        while (true) {
            val n = input.read(buffer)
            if (n < 0) break
            total += n
            if (total > MAX_BYTES) throw MediaException("Arquivo maior que 50 MB.")
            out.write(buffer, 0, n)
        }
    }

    /** Apaga os arquivos usados há mais tempo quando o cache passa do limite. */
    private fun trimCache(dir: File) {
        val files = dir.listFiles()?.sortedBy { it.lastModified() } ?: return
        var total = files.sumOf { it.length() }
        for (f in files) {
            if (total <= MAX_CACHE_BYTES) break
            total -= f.length()
            f.delete()
        }
    }

    private fun sha1(text: String): String =
        MessageDigest.getInstance("SHA-1").digest(text.toByteArray())
            .joinToString("") { "%02x".format(it) }
}
