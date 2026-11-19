package com.corretorkeyboard.keyboard

import android.graphics.Bitmap
import android.media.MediaMetadataRetriever
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.util.concurrent.Executors

/**
 * VideoThumbModule
 * ---------------------------------------------------------------------------
 * Capa dos vídeos do Locker (app e teclado), exposta ao JS como
 * `NativeModules.KeyconVideoThumb`. Tira um quadro do começo do vídeo (do link
 * da nuvem ou de um arquivo do aparelho), reduz para no máximo 480 px e guarda
 * em JPEG no cache: da segunda vez em diante a capa abre na hora.
 *
 * O nome no cache vem de `key` (o caminho do arquivo na nuvem), e não do link:
 * o link do R2 muda quando é renovado, o vídeo não.
 */
class VideoThumbModule(ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {

    override fun getName() = "KeyconVideoThumb"

    @ReactMethod
    fun thumbnail(url: String, key: String, promise: Promise) {
        worker.execute {
            try {
                val dir = File(reactApplicationContext.cacheDir, DIR).apply { mkdirs() }
                val safe = key.replace(Regex("[^A-Za-z0-9._-]"), "_").takeLast(120).ifEmpty { "video" }
                val file = File(dir, "$safe.jpg")
                if (file.length() > 0) {
                    promise.resolve("file://${file.absolutePath}")
                    return@execute
                }
                val frame = grabFrame(url)
                if (frame == null) {
                    promise.resolve(null)
                    return@execute
                }
                file.outputStream().use { frame.compress(Bitmap.CompressFormat.JPEG, 80, it) }
                frame.recycle()
                promise.resolve("file://${file.absolutePath}")
            } catch (t: Throwable) {
                // Sem capa (sem internet, formato que o Android não lê): o JS mostra o ícone
                promise.resolve(null)
            }
        }
    }

    /** Quadro de ~1 s (ou o primeiro, em vídeos curtos), já reduzido. */
    private fun grabFrame(url: String): Bitmap? {
        val retriever = MediaMetadataRetriever()
        try {
            when {
                url.startsWith("http://") || url.startsWith("https://") -> retriever.setDataSource(url, HashMap())
                url.startsWith("file://") -> retriever.setDataSource(url.removePrefix("file://"))
                else -> retriever.setDataSource(url)
            }
            val opt = MediaMetadataRetriever.OPTION_CLOSEST_SYNC
            val frame = if (Build.VERSION.SDK_INT >= 27) {
                retriever.getScaledFrameAtTime(FRAME_US, opt, MAX_SIDE, MAX_SIDE)
                    ?: retriever.getScaledFrameAtTime(0, opt, MAX_SIDE, MAX_SIDE)
            } else {
                (retriever.getFrameAtTime(FRAME_US, opt) ?: retriever.getFrameAtTime(0, opt))?.let(::shrink)
            }
            return frame
        } finally {
            try {
                retriever.release()
            } catch (_: Throwable) {
            }
        }
    }

    private fun shrink(src: Bitmap): Bitmap {
        val side = maxOf(src.width, src.height)
        if (side <= MAX_SIDE) return src
        val scale = MAX_SIDE.toFloat() / side
        val out = Bitmap.createScaledBitmap(src, (src.width * scale).toInt(), (src.height * scale).toInt(), true)
        if (out != src) src.recycle()
        return out
    }

    companion object {
        private const val DIR = "video-thumbs"
        private const val MAX_SIDE = 480
        private const val FRAME_US = 1_000_000L

        /** Uma capa por vez: ler vídeo pela internet é pesado para o celular. */
        private val worker = Executors.newSingleThreadExecutor()
    }
}
