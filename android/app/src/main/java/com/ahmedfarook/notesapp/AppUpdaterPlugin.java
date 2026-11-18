package com.ahmedfarook.notesapp;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.util.List;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    private long downloadId = -1;
    private BroadcastReceiver onCompleteReceiver = null;

    private void fallbackToBrowser(Context context, String url) {
        try {
            Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            browserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(browserIntent);
        } catch (Exception ignored) {}
    }

    @PluginMethod
    public void openInBrowser(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("URL is required");
            return;
        }
        fallbackToBrowser(getContext(), url);
        call.resolve();
    }

    @PluginMethod
    public void installUpdate(PluginCall call) {
        String downloadUrl = call.getString("url");
        if (downloadUrl == null || downloadUrl.isEmpty()) {
            call.reject("URL is required");
            return;
        }

        final String targetDownloadUrl = downloadUrl;
        Context context = getContext();
        DownloadManager dm = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
        if (dm == null) {
            fallbackToBrowser(context, targetDownloadUrl);
            call.reject("DownloadManager service not available");
            return;
        }

        File downloadsDir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        File targetFile = new File(downloadsDir, "texo-update.apk");
        if (targetFile.exists()) {
            targetFile.delete();
        }

        // Clean up legacy Apple-Notes-update.apk to avoid installing stale version
        File legacyFile = new File(downloadsDir, "Apple-Notes-update.apk");
        if (legacyFile.exists()) {
            legacyFile.delete();
        }

        Uri uri = Uri.parse(targetDownloadUrl);
        DownloadManager.Request request = new DownloadManager.Request(uri);
        request.setTitle("texō Update");
        request.setDescription("Downloading latest update...");
        request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
        request.setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, "texo-update.apk");
        request.setMimeType("application/vnd.android.package-archive");

        try {
            downloadId = dm.enqueue(request);

            if (onCompleteReceiver != null) {
                try {
                    context.unregisterReceiver(onCompleteReceiver);
                } catch (Exception ignored) {}
            }

            onCompleteReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context ctx, Intent intent) {
                    long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                    if (id == downloadId) {
                        try {
                            // 1. Verify download was successful via DownloadManager.Query
                            DownloadManager.Query query = new DownloadManager.Query();
                            query.setFilterById(downloadId);
                            Cursor cursor = dm.query(query);
                            if (cursor != null) {
                                if (cursor.moveToFirst()) {
                                    int statusIndex = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
                                    if (statusIndex != -1) {
                                        int status = cursor.getInt(statusIndex);
                                        if (status != DownloadManager.STATUS_SUCCESSFUL) {
                                            cursor.close();
                                            fallbackToBrowser(context, targetDownloadUrl);
                                            JSObject err = new JSObject();
                                            err.put("error", "Download incomplete (status code " + status + "). Opening browser fallback.");
                                            notifyListeners("updateError", err);
                                            return;
                                        }
                                    }
                                }
                                cursor.close();
                            }

                            File apkFile = targetFile;
                            if (!apkFile.exists()) {
                                apkFile = new File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "texo-update.apk");
                            }

                            // 2. Verify APK file exists and is not truncated/corrupted (> 1MB)
                            if (!apkFile.exists() || apkFile.length() < 1000000) {
                                if (apkFile.exists()) {
                                    apkFile.delete();
                                }
                                fallbackToBrowser(context, targetDownloadUrl);
                                JSObject err = new JSObject();
                                err.put("error", "Downloaded APK was incomplete or corrupted. Opened browser fallback.");
                                notifyListeners("updateError", err);
                                return;
                            }

                            // 3. Check permission for unknown app sources before launching installer
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                if (!context.getPackageManager().canRequestPackageInstalls()) {
                                    Intent settingsIntent = new Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                                    settingsIntent.setData(Uri.parse("package:" + context.getPackageName()));
                                    settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                    context.startActivity(settingsIntent);

                                    JSObject err = new JSObject();
                                    err.put("error", "Please enable 'Install unknown apps' permission for texō and tap Update again.");
                                    notifyListeners("updateError", err);
                                    return;
                                }
                            }

                            // 4. Construct install intent and grant read permissions to all installer packages
                            Uri apkUri = FileProvider.getUriForFile(
                                context,
                                context.getPackageName() + ".fileprovider",
                                apkFile
                            );

                            Intent installIntent = new Intent(Intent.ACTION_VIEW);
                            installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                            installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

                            List<ResolveInfo> resInfoList = context.getPackageManager().queryIntentActivities(
                                installIntent,
                                PackageManager.MATCH_DEFAULT_ONLY
                            );
                            for (ResolveInfo resolveInfo : resInfoList) {
                                String packageName = resolveInfo.activityInfo.packageName;
                                context.grantUriPermission(packageName, apkUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                            }

                            context.startActivity(installIntent);

                            JSObject ret = new JSObject();
                            ret.put("success", true);
                            notifyListeners("updateDownloaded", ret);
                        } catch (Exception e) {
                            fallbackToBrowser(context, targetDownloadUrl);
                            JSObject err = new JSObject();
                            err.put("error", e.getMessage());
                            notifyListeners("updateError", err);
                        } finally {
                            try {
                                context.unregisterReceiver(this);
                                onCompleteReceiver = null;
                            } catch (Exception ignored) {}
                        }
                    }
                }
            };

            IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.registerReceiver(onCompleteReceiver, filter, Context.RECEIVER_EXPORTED);
            } else {
                context.registerReceiver(onCompleteReceiver, filter);
            }

            JSObject res = new JSObject();
            res.put("started", true);
            call.resolve(res);
        } catch (Exception e) {
            fallbackToBrowser(context, targetDownloadUrl);
            call.reject("Failed to start download: " + e.getMessage());
        }
    }
}
