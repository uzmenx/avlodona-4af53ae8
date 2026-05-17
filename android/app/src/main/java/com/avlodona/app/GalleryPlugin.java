package com.avlodona.app;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.util.Log;
import android.graphics.Bitmap;
import android.util.Size;
import java.io.ByteArrayOutputStream;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

@CapacitorPlugin(
    name = "Gallery",
    permissions = {
        @Permission(
            alias = "publicStorage",
            strings = {
                Manifest.permission.READ_EXTERNAL_STORAGE,
                Manifest.permission.WRITE_EXTERNAL_STORAGE
            }
        ),
        @Permission(
            alias = "photos",
            strings = { "android.permission.READ_MEDIA_IMAGES" }
        ),
        @Permission(
            alias = "videos",
            strings = { "android.permission.READ_MEDIA_VIDEO" }
        ),
        @Permission(
            alias = "limited",
            strings = { "android.permission.READ_MEDIA_VISUAL_USER_SELECTED" }
        )
    }
)
public class GalleryPlugin extends Plugin {

    @PluginMethod
    public void getMedias(PluginCall call) {
        int quantity = call.getInt("quantity", 30);
        int offset = call.getInt("offset", 0);

        Log.d("GalleryPlugin", "Fetching medias: quantity=" + quantity + ", offset=" + offset);

        JSArray medias = new JSArray();
        ContentResolver contentResolver = getContext().getContentResolver();

        // Android 10+ da MediaStore.Images va MediaStore.Video ishlatish xavfsizroq
        // Biz ikkalasini ham o'qishimiz kerak
        
        // Projection
        String[] projection = {
                MediaStore.Files.FileColumns._ID,
                MediaStore.Files.FileColumns.MEDIA_TYPE,
                MediaStore.Files.FileColumns.DATE_ADDED,
                MediaStore.Video.VideoColumns.DURATION,
                MediaStore.Files.FileColumns.WIDTH,
                MediaStore.Files.FileColumns.HEIGHT
        };

        // Selection (Images and Videos)
        String selection = MediaStore.Files.FileColumns.MEDIA_TYPE + "="
                + MediaStore.Files.FileColumns.MEDIA_TYPE_IMAGE
                + " OR "
                + MediaStore.Files.FileColumns.MEDIA_TYPE + "="
                + MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO;

        // Content URI
        Uri queryUri = MediaStore.Files.getContentUri("external");

        Cursor cursor = null;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Bundle queryArgs = new Bundle();
                queryArgs.putString(ContentResolver.QUERY_ARG_SQL_SELECTION, selection);
                queryArgs.putString(ContentResolver.QUERY_ARG_SQL_SORT_ORDER, MediaStore.Files.FileColumns.DATE_ADDED + " DESC");
                queryArgs.putInt(ContentResolver.QUERY_ARG_LIMIT, quantity);
                queryArgs.putInt(ContentResolver.QUERY_ARG_OFFSET, offset);
                cursor = contentResolver.query(queryUri, projection, queryArgs, null);
            } else {
                String sortOrder = MediaStore.Files.FileColumns.DATE_ADDED + " DESC LIMIT " + quantity + " OFFSET " + offset;
                cursor = contentResolver.query(queryUri, projection, selection, null, sortOrder);
            }

            if (cursor != null) {
                Log.d("GalleryPlugin", "Cursor count: " + cursor.getCount());
                while (cursor.moveToNext()) {
                    JSObject media = new JSObject();
                    long id = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns._ID));
                    int type = cursor.getInt(cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.MEDIA_TYPE));
                    long date = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DATE_ADDED));
                    
                    // URI ni aniqlash
                    Uri contentUri;
                    if (type == MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO) {
                        contentUri = ContentUris.withAppendedId(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, id);
                    } else {
                        contentUri = ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id);
                    }

                    int durationIdx = cursor.getColumnIndex(MediaStore.Video.VideoColumns.DURATION);
                    long duration = durationIdx != -1 ? cursor.getLong(durationIdx) : 0;
                    
                    int widthIdx = cursor.getColumnIndex(MediaStore.Files.FileColumns.WIDTH);
                    int width = widthIdx != -1 ? cursor.getInt(widthIdx) : 0;
                    
                    int heightIdx = cursor.getColumnIndex(MediaStore.Files.FileColumns.HEIGHT);
                    int height = heightIdx != -1 ? cursor.getInt(heightIdx) : 0;

                    media.put("identifier", String.valueOf(id));
                    media.put("path", contentUri.toString()); // content://... formatida
                    media.put("mediaType", type == MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO ? 2 : 1);
                    media.put("creationDate", date * 1000L);
                    media.put("duration", duration / 1000.0);
                    media.put("width", width);
                    media.put("height", height);

                    // Base64 thumbnail generation for modern Android 10+ (API 29+)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        try {
                            Bitmap thumb = contentResolver.loadThumbnail(contentUri, new Size(250, 250), null);
                            ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
                            thumb.compress(Bitmap.CompressFormat.JPEG, 70, byteArrayOutputStream);
                            byte[] byteArray = byteArrayOutputStream.toByteArray();
                            String base64 = android.util.Base64.encodeToString(byteArray, android.util.Base64.NO_WRAP);
                            media.put("data", base64);
                        } catch (Exception e) {
                            Log.e("GalleryPlugin", "Error generating thumbnail for id: " + id, e);
                        }
                    }

                    medias.put(media);
                }
            } else {
                Log.d("GalleryPlugin", "Cursor is null");
            }
        } catch (Exception e) {
            Log.e("GalleryPlugin", "Error fetching media", e);
            call.reject("Error fetching media: " + e.getMessage());
            return;
        } finally {
            if (cursor != null) {
                cursor.close();
            }
        }

        JSObject response = new JSObject();
        response.put("medias", medias);
        call.resolve(response);
    }
}
