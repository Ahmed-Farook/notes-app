package com.ahmedfarook.notesapp;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
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

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    private long downloadId = -1;
    private BroadcastReceiver onCompleteReceiver = null;

    @PluginMethod
    public void installUpdate(PluginCall call) {
        String downloadUrl = call.getString("url");
        if (downloadUrl == null || downloadUrl.isEmpty()) {
            call.reject("URL is required");
            return;
        }

        Context context = getContext();
        DownloadManager dm = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
        if (dm == null) {
            call.reject("DownloadManager service not available");
            return;
        }

        File targetFile = new File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "Apple-Notes-update.apk");
        if (targetFile.exists()) {
            targetFile.delete();
        }

        Uri uri = Uri.parse(downloadUrl);
        DownloadManager.Request request = new DownloadManager.Request(uri);
        request.setTitle("Apple Notes Update");
        request.setDescription("Downloading latest update...");
        request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
        request.setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, "Apple-Notes-update.apk");
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
                            File apkFile = new File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "Apple-Notes-update.apk");
                            if (apkFile.exists()) {
                                Uri apkUri = FileProvider.getUriForFile(
                                    context,
                                    context.getPackageName() + ".fileprovider",
                                    apkFile
                                );

                                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                    if (!context.getPackageManager().canRequestPackageInstalls()) {
                                        Intent settingsIntent = new Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                                        settingsIntent.setData(Uri.parse("package:" + context.getPackageName()));
                                        settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                        context.startActivity(settingsIntent);
                                    }
                                }

                                Intent installIntent = new Intent(Intent.ACTION_VIEW);
                                installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                                installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                                context.startActivity(installIntent);

                                JSObject ret = new JSObject();
                                ret.put("success", true);
                                notifyListeners("updateDownloaded", ret);
                            }
                        } catch (Exception e) {
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
            call.reject("Failed to start download: " + e.getMessage());
        }
    }
}

