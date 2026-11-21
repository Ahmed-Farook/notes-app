package com.ahmedfarook.notesapp;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONArray;
import org.json.JSONObject;

public class QuickAddTaskActivity extends AppCompatActivity {

    private String noteId = "";
    private String noteTitle = "To-Do List";
    private int appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_quick_add_task);

        noteId = getIntent().getStringExtra("note_id");
        noteTitle = getIntent().getStringExtra("note_title");
        appWidgetId = getIntent().getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);

        SharedPreferences prefs = getSharedPreferences(TodoWidget.PREFS_NAME, Context.MODE_PRIVATE);

        // Fallback note ID / title if not provided
        if (noteId == null || noteId.isEmpty()) {
            String allJson = prefs.getString(TodoWidget.KEY_ALL_CHECKLISTS_JSON, "[]");
            try {
                JSONArray arr = new JSONArray(allJson);
                if (arr.length() > 0) {
                    JSONObject first = arr.getJSONObject(0);
                    noteId = first.optString("id", "");
                    noteTitle = first.optString("title", "To-Do List");
                }
            } catch (Exception ignored) {}

            if (noteId == null || noteId.isEmpty()) {
                noteId = prefs.getString(TodoWidget.KEY_NOTE_ID, "");
                noteTitle = prefs.getString(TodoWidget.KEY_NOTE_TITLE, "To-Do List");
            }
        }

        TextView titleView = findViewById(R.id.quick_add_title);
        if (titleView != null && noteTitle != null && !noteTitle.isEmpty()) {
            titleView.setText("Add to " + noteTitle);
        }

        final EditText taskInput = findViewById(R.id.edit_quick_task);
        Button btnAdd = findViewById(R.id.btn_quick_add);
        Button btnCancel = findViewById(R.id.btn_quick_cancel);
        ImageButton btnClose = findViewById(R.id.btn_quick_close);

        View.OnClickListener closeListener = v -> {
            finishWithoutAnimation();
        };

        if (btnCancel != null) btnCancel.setOnClickListener(closeListener);
        if (btnClose != null) btnClose.setOnClickListener(closeListener);

        View.OnClickListener addListener = v -> {
            if (taskInput != null) {
                String text = taskInput.getText().toString().trim();
                if (!text.isEmpty()) {
                    addTaskAndDismiss(text);
                }
            }
        };

        if (btnAdd != null) btnAdd.setOnClickListener(addListener);

        if (taskInput != null) {
            taskInput.setOnEditorActionListener((v, actionId, event) -> {
                if (actionId == EditorInfo.IME_ACTION_DONE ||
                    (event != null && event.getKeyCode() == KeyEvent.KEYCODE_ENTER && event.getAction() == KeyEvent.ACTION_DOWN)) {
                    String text = taskInput.getText().toString().trim();
                    if (!text.isEmpty()) {
                        addTaskAndDismiss(text);
                        return true;
                    }
                }
                return false;
            });

            // Automatically focus and show soft keyboard immediately
            taskInput.requestFocus();
            taskInput.postDelayed(() -> {
                InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
                if (imm != null) {
                    imm.showSoftInput(taskInput, InputMethodManager.SHOW_IMPLICIT);
                }
            }, 100);
        }
    }

    private void addTaskAndDismiss(String text) {
        try {
            SharedPreferences prefs = getSharedPreferences(TodoWidget.PREFS_NAME, Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = prefs.edit();

            // 1. Add to KEY_ALL_CHECKLISTS_JSON
            String allJson = prefs.getString(TodoWidget.KEY_ALL_CHECKLISTS_JSON, "[]");
            JSONArray arr = new JSONArray(allJson);
            boolean addedToAll = false;

            for (int i = 0; i < arr.length(); i++) {
                JSONObject noteObj = arr.getJSONObject(i);
                if (noteObj.optString("id", "").equals(noteId) || (noteId == null || noteId.isEmpty())) {
                    JSONArray itemsArr = noteObj.optJSONArray("items");
                    if (itemsArr == null) {
                        itemsArr = new JSONArray();
                        noteObj.put("items", itemsArr);
                    }
                    JSONObject newItem = new JSONObject();
                    newItem.put("text", text);
                    newItem.put("checked", false);
                    itemsArr.put(newItem);
                    addedToAll = true;
                    break;
                }
            }

            if (addedToAll) {
                editor.putString(TodoWidget.KEY_ALL_CHECKLISTS_JSON, arr.toString());
            }

            // 2. Also append to legacy single items json
            String singleJson = prefs.getString(TodoWidget.KEY_ITEMS_JSON, "[]");
            try {
                JSONArray singleArr = new JSONArray(singleJson);
                JSONObject newItem = new JSONObject();
                newItem.put("text", text);
                newItem.put("checked", false);
                singleArr.put(newItem);
                editor.putString(TodoWidget.KEY_ITEMS_JSON, singleArr.toString());
            } catch (Exception ignored) {}

            // 3. Record pending add so Capacitor/Web sync adds it to note HTML content
            String pendingAddsStr = prefs.getString(TodoWidget.KEY_PENDING_ADDS, "[]");
            JSONArray pendingAdds;
            try {
                pendingAdds = new JSONArray(pendingAddsStr);
            } catch (Exception e) {
                pendingAdds = new JSONArray();
            }

            JSONObject addEvent = new JSONObject();
            addEvent.put("noteId", noteId != null ? noteId : "");
            addEvent.put("text", text);
            addEvent.put("timestamp", System.currentTimeMillis());
            pendingAdds.put(addEvent);
            editor.putString(TodoWidget.KEY_PENDING_ADDS, pendingAdds.toString());

            editor.apply();

            // 4. Notify widget to update scrollable list immediately
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(this);
            if (appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
                appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetId, R.id.widget_todo_listview);
            } else {
                ComponentName thisWidget = new ComponentName(this, TodoWidget.class);
                int[] ids = appWidgetManager.getAppWidgetIds(thisWidget);
                if (ids != null && ids.length > 0) {
                    appWidgetManager.notifyAppWidgetViewDataChanged(ids, R.id.widget_todo_listview);
                }
            }

        } catch (Exception e) {
            e.printStackTrace();
        }

        finishWithoutAnimation();
    }

    private void finishWithoutAnimation() {
        finish();
        overridePendingTransition(0, 0);
    }
}
