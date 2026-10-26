package com.corretorkeyboard.keyboard

import android.Manifest
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import android.provider.OpenableColumns
import android.webkit.MimeTypeMap
import java.io.File
import java.util.concurrent.Executors

/**
 * MediaPickActivity
 * ---------------------------------------------------------------------------
 * Tela invisível que o TECLADO abre para escolher uma foto, um vídeo ou um
 * áudio do celular, para usar a câmera e para pedir a permissão do microfone
 * (gravar atalhos de áudio). O teclado é um serviço (não uma Activity), então
 * não consegue abrir o seletor nem o pedido de permissão e receber a resposta.
 *
 * Fica numa tarefa própria (taskAffinity vazio no manifesto): ao terminar, a
 * conversa que estava aberta volta para a frente, e não o app KEYCON.
 *
 * O arquivo escolhido é copiado para cache/picked (fotos saem em JPEG de até
 * 2048 px, como no app) e entregue ao KeyboardBridge pelo [callback].
 */
class MediaPickActivity : Activity() {

    /** Arquivo escolhido e pronto no cache do app. */
    data class Picked(val file: File, val name: String, val mimeType: String, val durationMs: Long?)

    sealed class Result {
        data class Ok(val picked: Picked) : Result()
        object Cancelled : Result()
        data class Error(val message: String) : Result()
        /** Pedido do microfone: "granted", "denied" ou "blocked" (negou com "não perguntar de novo"). */
        data class Permission(val state: String) : Result()
    }

    /** Arquivo onde a câmera grava (sobrevive à recriação da tela). */
    private var cameraFile: File? = null
    private var cameraMime: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (savedInstanceState != null) {
            // Recriada (ex.: girou a tela) com o seletor já aberto: só espera a resposta
            cameraFile = savedInstanceState.getString(STATE_CAMERA_FILE)?.let { File(it) }
            cameraMime = savedInstanceState.getString(STATE_CAMERA_MIME)
            return
        }
        try {
            when (val source = intent.getStringExtra(EXTRA_SOURCE)) {
                SOURCE_CAMERA_PHOTO, SOURCE_CAMERA_VIDEO -> openCamera(source == SOURCE_CAMERA_VIDEO)
                SOURCE_GALLERY_PHOTO -> openGallery(photosOnly = true)
                SOURCE_AUDIO -> openAudioFiles()
                SOURCE_MIC_PERMISSION -> requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), REQUEST_MIC)
                else -> openGallery(photosOnly = false)
            }
        } catch (_: ActivityNotFoundException) {
            finishWith(Result.Error("Nenhum app de galeria ou câmera encontrado neste aparelho."))
        } catch (t: Throwable) {
            finishWith(Result.Error(t.message ?: "Não foi possível abrir a galeria ou a câmera."))
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        cameraFile?.let { outState.putString(STATE_CAMERA_FILE, it.absolutePath) }
        cameraMime?.let { outState.putString(STATE_CAMERA_MIME, it) }
    }

    /**
     * Fotos e vídeos juntos (ou só fotos, para a imagem do produto).
     * Android 13+: seletor de fotos do sistema (sem pedir permissão).
     */
    private fun openGallery(photosOnly: Boolean) {
        val intent = if (Build.VERSION.SDK_INT >= 33) {
            Intent(MediaStore.ACTION_PICK_IMAGES).apply { if (photosOnly) type = "image/*" }
        } else if (photosOnly) {
            Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE).setType("image/*")
        } else {
            Intent(Intent.ACTION_GET_CONTENT)
                .addCategory(Intent.CATEGORY_OPENABLE)
                .setType("*/*")
                .putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("image/*", "video/*"))
        }
        startActivityForResult(intent, REQUEST_GALLERY)
    }

    /** Arquivos de áudio do celular (mp3, m4a, ogg, wav...), pelo seletor de arquivos do sistema. */
    private fun openAudioFiles() {
        val intent = Intent(Intent.ACTION_GET_CONTENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType("audio/*")
            .putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("audio/*", "application/ogg"))
        startActivityForResult(intent, REQUEST_AUDIO)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != REQUEST_MIC) return
        val state = when {
            grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED -> "granted"
            // Negou e marcou "não perguntar de novo": só nas Configurações do Android
            !shouldShowRequestPermissionRationale(Manifest.permission.RECORD_AUDIO) -> "blocked"
            else -> "denied"
        }
        finishWith(Result.Permission(state))
    }

    /** Câmera do próprio celular: o KEYCON não precisa da permissão de câmera. */
    private fun openCamera(video: Boolean) {
        val ext = if (video) "mp4" else "jpg"
        val file = newPickedFile(this, ext)
        cameraFile = file
        cameraMime = if (video) "video/mp4" else "image/jpeg"
        val uri = MediaFiles.uriFor(this, file)
        val intent = Intent(if (video) MediaStore.ACTION_VIDEO_CAPTURE else MediaStore.ACTION_IMAGE_CAPTURE)
            .putExtra(MediaStore.EXTRA_OUTPUT, uri)
            .addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
        if (video) intent.putExtra(MediaStore.EXTRA_DURATION_LIMIT, MAX_VIDEO_SECONDS)
        startActivityForResult(intent, REQUEST_CAMERA)
    }

    @Deprecated("Activity simples, sem AndroidX")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (resultCode != RESULT_OK) {
            cameraFile?.delete()
            finishWith(Result.Cancelled)
            return
        }
        val appContext = applicationContext
        val camera = cameraFile
        val cameraType = cameraMime
        val source = data?.data
        // Copiar e reduzir a foto pode levar alguns segundos: fora da tela
        worker.execute {
            val result = try {
                when {
                    requestCode == REQUEST_CAMERA && camera != null && camera.length() > 0 ->
                        Result.Ok(prepareFile(appContext, camera, cameraType ?: "image/jpeg", camera.name))
                    // Alguns apps de câmera ignoram o EXTRA_OUTPUT e devolvem o link
                    source != null -> Result.Ok(copyFromUri(appContext, source))
                    else -> Result.Cancelled
                }
            } catch (t: MediaFiles.MediaException) {
                Result.Error(t.message ?: "Não foi possível ler o arquivo.")
            } catch (t: Throwable) {
                Result.Error("Não foi possível ler o arquivo escolhido.")
            }
            runOnUiThread { finishWith(result) }
        }
    }

    private fun finishWith(result: Result) {
        deliver(result)
        finish()
        // Sem animação: a conversa volta como estava
        @Suppress("DEPRECATION")
        overridePendingTransition(0, 0)
    }

    override fun onDestroy() {
        super.onDestroy()
        // Fechada sem resposta (ex.: o sistema encerrou a tela): o teclado não fica esperando
        if (isFinishing) deliver(Result.Cancelled)
    }

    companion object {
        const val EXTRA_SOURCE = "source"
        const val SOURCE_GALLERY = "gallery"
        const val SOURCE_GALLERY_PHOTO = "gallery-photo"
        const val SOURCE_CAMERA_PHOTO = "camera-photo"
        const val SOURCE_CAMERA_VIDEO = "camera-video"
        const val SOURCE_AUDIO = "audio"
        const val SOURCE_MIC_PERMISSION = "mic-permission"

        private const val REQUEST_GALLERY = 1
        private const val REQUEST_CAMERA = 2
        private const val REQUEST_AUDIO = 3
        private const val REQUEST_MIC = 4
        private const val STATE_CAMERA_FILE = "cameraFile"
        private const val STATE_CAMERA_MIME = "cameraMime"
        private const val DIR = "picked"
        private const val MAX_BYTES = 50L * 1024 * 1024
        private const val MAX_PHOTO_SIDE = 2048
        private const val MAX_VIDEO_SECONDS = 180

        private val worker = Executors.newSingleThreadExecutor()

        /** Quem pediu o arquivo (o KeyboardBridge). Chamado uma única vez. */
        @Volatile
        private var callback: ((Result) -> Unit)? = null

        /** O microfone já está liberado para o KEYCON? */
        fun hasMicPermission(context: Context): Boolean =
            context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

        /** Abre o seletor; o resultado chega em [onResult] (na main thread). */
        fun start(context: Context, source: String, onResult: (Result) -> Unit) {
            // Um pedido anterior ainda aberto é dado como cancelado
            deliver(Result.Cancelled)
            callback = onResult
            val intent = Intent(context, MediaPickActivity::class.java)
                .putExtra(EXTRA_SOURCE, source)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_ANIMATION)
            context.startActivity(intent)
        }

        private fun deliver(result: Result) {
            val cb = callback ?: return
            callback = null
            cb(result)
        }

        private fun newPickedFile(context: Context, ext: String): File {
            val dir = File(context.cacheDir, DIR).apply { mkdirs() }
            // Arquivos de escolhas antigas (já enviados para a nuvem) saem daqui
            val old = System.currentTimeMillis() - 24L * 60 * 60 * 1000
            dir.listFiles()?.filter { it.lastModified() < old }?.forEach { it.delete() }
            return File(dir, "${System.currentTimeMillis()}-${(1000..9999).random()}.$ext")
        }

        private fun copyFromUri(context: Context, uri: Uri): Picked {
            val resolver = context.contentResolver
            val mime = resolver.getType(uri)?.lowercase() ?: "application/octet-stream"
            val audio = mime.startsWith("audio/") || mime == "application/ogg"
            if (!mime.startsWith("image/") && !mime.startsWith("video/") && !audio) {
                throw MediaFiles.MediaException("Escolha uma foto, um vídeo ou um áudio.")
            }
            var name: String? = null
            var size = -1L
            resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { c ->
                if (c.moveToFirst()) {
                    name = c.getString(0)
                    if (!c.isNull(1)) size = c.getLong(1)
                }
            }
            if (size > MAX_BYTES) throw MediaFiles.MediaException("O arquivo passa de 50 MB. Escolha um menor.")

            val ext = MimeTypeMap.getSingleton().getExtensionFromMimeType(mime) ?: "bin"
            val target = newPickedFile(context, ext)
            resolver.openInputStream(uri)?.use { input ->
                target.outputStream().use { out ->
                    val buffer = ByteArray(64 * 1024)
                    var total = 0L
                    while (true) {
                        val n = input.read(buffer)
                        if (n < 0) break
                        total += n
                        if (total > MAX_BYTES) {
                            out.close()
                            target.delete()
                            throw MediaFiles.MediaException("O arquivo passa de 50 MB. Escolha um menor.")
                        }
                        out.write(buffer, 0, n)
                    }
                }
            } ?: throw MediaFiles.MediaException("Não foi possível ler o arquivo escolhido.")
            return prepareFile(context, target, mime, name ?: target.name)
        }

        /** Foto: reduz para JPEG de até 2048 px (GIF e PNG ficam como estão). Vídeo e áudio: lê a duração. */
        private fun prepareFile(context: Context, file: File, mime: String, name: String): Picked {
            if (mime.startsWith("video/")) {
                if (file.length() > MAX_BYTES) {
                    file.delete()
                    throw MediaFiles.MediaException("O vídeo passa de 50 MB. Grave um mais curto.")
                }
                return Picked(file, name, mime, mediaDuration(file))
            }
            if (mime.startsWith("audio/") || mime == "application/ogg") {
                if (file.length() > MAX_BYTES) {
                    file.delete()
                    throw MediaFiles.MediaException("O áudio passa de 50 MB.")
                }
                return Picked(file, name, mime, mediaDuration(file))
            }
            if (mime == "image/gif" || mime == "image/png") return Picked(file, name, mime, null)
            val jpeg = shrinkPhoto(context, file) ?: return Picked(file, name, mime, null)
            if (jpeg != file) file.delete()
            return Picked(jpeg, name.substringBeforeLast('.') + ".jpg", "image/jpeg", null)
        }

        private fun shrinkPhoto(context: Context, file: File): File? {
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(file.absolutePath, bounds)
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
            var sample = 1
            while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= MAX_PHOTO_SIDE) sample *= 2
            val decoded = BitmapFactory.decodeFile(file.absolutePath, BitmapFactory.Options().apply { inSampleSize = sample })
                ?: return null

            val matrix = Matrix()
            val longest = maxOf(decoded.width, decoded.height)
            if (longest > MAX_PHOTO_SIDE) {
                val scale = MAX_PHOTO_SIDE.toFloat() / longest
                matrix.postScale(scale, scale)
            }
            // Foto de celular deitada/em pé: aplica a orientação da câmera (EXIF)
            val rotation = when (ExifInterface(file.absolutePath).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
                ExifInterface.ORIENTATION_ROTATE_90 -> 90f
                ExifInterface.ORIENTATION_ROTATE_180 -> 180f
                ExifInterface.ORIENTATION_ROTATE_270 -> 270f
                else -> 0f
            }
            if (rotation != 0f) matrix.postRotate(rotation)
            val bitmap = if (matrix.isIdentity) decoded else Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, matrix, true)

            val out = newPickedFile(context, "jpg")
            out.outputStream().use { bitmap.compress(Bitmap.CompressFormat.JPEG, 80, it) }
            if (bitmap != decoded) bitmap.recycle()
            decoded.recycle()
            return out
        }

        private fun mediaDuration(file: File): Long? {
            val retriever = MediaMetadataRetriever()
            return try {
                retriever.setDataSource(file.absolutePath)
                retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull()
            } catch (_: Throwable) {
                null
            } finally {
                retriever.release()
            }
        }
    }
}
