package com.example.bai1.sos.repository

import android.content.Context
import android.net.Uri
import android.webkit.MimeTypeMap
import com.google.firebase.storage.FirebaseStorage
import kotlinx.coroutines.tasks.await

class FirebaseSosPhotoUploader(private val context: Context) {
    suspend fun uploadSosPhoto(uri: Uri, eventId: String): Result<String> {
        return try {
            val contentResolver = context.contentResolver
            
            // Open InputStream
            val inputStream = contentResolver.openInputStream(uri)
                ?: return Result.failure(Exception("Cannot open InputStream for URI: $uri"))
                
            // Extract MIME type and extension
            val mimeType = contentResolver.getType(uri) ?: "image/jpeg"
            val extension = MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType) ?: "jpg"
            val timestamp = System.currentTimeMillis()
            val fileName = "$timestamp.$extension"
            
            // Path: sos/{eventId}/{fileName}
            val storageRef = FirebaseStorage.getInstance().reference
            val photoRef = storageRef.child("sos").child(eventId).child(fileName)
            
            // Upload
            photoRef.putStream(inputStream).await()
            
            // Get Download URL
            val downloadUrl = photoRef.downloadUrl.await().toString()
            Result.success(downloadUrl)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
