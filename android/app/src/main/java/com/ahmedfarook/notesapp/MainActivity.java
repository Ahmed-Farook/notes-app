package com.ahmedfarook.notesapp;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppUpdaterPlugin.class);
        registerPlugin(BiometricAuthPlugin.class);
        registerPlugin(NotesWidgetPlugin.class);
        super.onCreate(savedInstanceState);
        handleWidgetIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleWidgetIntent(intent);
    }

    private void handleWidgetIntent(Intent intent) {
        if (intent == null) return;

        if (getBridge() != null && getBridge().getWebView() != null) {
            if ("add_checklist_item".equals(intent.getStringExtra("action")) || "com.ahmedfarook.notesapp.ADD_CHECKLIST_ITEM".equals(intent.getAction())) {
                String noteId = intent.getStringExtra("note_id");
                getBridge().getWebView().postDelayed(() -> {
                    getBridge().getWebView().evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('action:add-checklist-item', { detail: { noteId: '" + (noteId != null ? noteId : "") + "' } }));",
                        null
                    );
                }, 400);
            } else if (QuickNoteWidget.ACTION_NEW_NOTE.equals(intent.getAction())) {
                getBridge().getWebView().postDelayed(() -> {
                    getBridge().getWebView().evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('action:new-note'));",
                        null
                    );
                }, 400);
            } else if (intent.hasExtra("note_id")) {
                String noteId = intent.getStringExtra("note_id");
                if (noteId != null && !noteId.isEmpty()) {
                    getBridge().getWebView().postDelayed(() -> {
                        getBridge().getWebView().evaluateJavascript(
                            "window.dispatchEvent(new CustomEvent('action:open-note', { detail: { noteId: '" + noteId + "' } }));",
                            null
                        );
                    }, 400);
                }
            }
        }
    }
}
