package com.ahmedfarook.notesapp;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

public class TodoWidget extends AppWidgetProvider {

    public static final String ACTION_TOGGLE_TODO = "com.ahmedfarook.notesapp.ACTION_TOGGLE_TODO";
    public static final String PREFS_NAME = "texo_widget_prefs";
    public static final String KEY_NOTE_ID = "widget_note_id";
    public static final String KEY_NOTE_TITLE = "widget_note_title";
    public static final String KEY_ITEMS_JSON = "widget_items_json";
    public static final String KEY_ALL_CHECKLISTS_JSON = "widget_all_checklists_json";
    public static final String KEY_PENDING_TOGGLES = "widget_pending_toggles";
    public static final String KEY_PENDING_ADDS = "widget_pending_adds";

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);

        if (ACTION_TOGGLE_TODO.equals(intent.getAction())) {
            int itemIndex = intent.getIntExtra("item_index", -1);
            String noteId = intent.getStringExtra("note_id");
            int appWidgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);

            if (itemIndex >= 0) {
                toggleTodoItem(context, noteId, itemIndex, appWidgetId);
            }
        }
    }

    private void toggleTodoItem(Context context, String noteId, int itemIndex, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String allJson = prefs.getString(KEY_ALL_CHECKLISTS_JSON, "[]");

        try {
            JSONArray arr = new JSONArray(allJson);
            boolean toggledState = false;
            boolean updatedInAll = false;

            for (int i = 0; i < arr.length(); i++) {
                JSONObject noteObj = arr.getJSONObject(i);
                if (noteObj.optString("id", "").equals(noteId) || (noteId == null || noteId.isEmpty())) {
                    JSONArray itemsArr = noteObj.optJSONArray("items");
                    if (itemsArr != null && itemIndex < itemsArr.length()) {
                        JSONObject it = itemsArr.getJSONObject(itemIndex);
                        boolean cur = it.optBoolean("checked", false);
                        toggledState = !cur;
                        it.put("checked", toggledState);
                        updatedInAll = true;
                    }
                    break;
                }
            }

            SharedPreferences.Editor editor = prefs.edit();
            if (updatedInAll) {
                editor.putString(KEY_ALL_CHECKLISTS_JSON, arr.toString());
            }

            // Also update legacy single items json if matching
            String singleJson = prefs.getString(KEY_ITEMS_JSON, "[]");
            try {
                JSONArray singleArr = new JSONArray(singleJson);
                if (itemIndex < singleArr.length()) {
                    JSONObject singleIt = singleArr.getJSONObject(itemIndex);
                    singleIt.put("checked", toggledState);
                    editor.putString(KEY_ITEMS_JSON, singleArr.toString());
                }
            } catch (Exception ignored) {}

            // Record pending toggle event so web/desktop app syncs it upon opening
            JSONArray pending;
            String pendingStr = prefs.getString(KEY_PENDING_TOGGLES, "[]");
            try {
                pending = new JSONArray(pendingStr);
            } catch (Exception e) {
                pending = new JSONArray();
            }

            JSONObject toggleEvent = new JSONObject();
            toggleEvent.put("noteId", noteId != null ? noteId : "");
            toggleEvent.put("itemIndex", itemIndex);
            toggleEvent.put("checked", toggledState);
            toggleEvent.put("timestamp", System.currentTimeMillis());
            pending.put(toggleEvent);

            editor.putString(KEY_PENDING_TOGGLES, pending.toString());
            editor.apply();

            // Notify ListView to refresh scrollable content
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            if (appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
                appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetId, R.id.widget_todo_listview);
            } else {
                ComponentName thisWidget = new ComponentName(context, TodoWidget.class);
                int[] ids = appWidgetManager.getAppWidgetIds(thisWidget);
                if (ids != null && ids.length > 0) {
                    appWidgetManager.notifyAppWidgetViewDataChanged(ids, R.id.widget_todo_listview);
                }
            }

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    @Override
    public void onDeleted(Context context, int[] appWidgetIds) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        for (int appWidgetId : appWidgetIds) {
            editor.remove(TodoWidgetConfigureActivity.PREF_PREFIX_KEY + appWidgetId);
            editor.remove(TodoWidgetConfigureActivity.PREF_TITLE_PREFIX_KEY + appWidgetId);
        }
        editor.apply();
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        // Retrieve the note assigned to this widget
        String noteId = prefs.getString(TodoWidgetConfigureActivity.PREF_PREFIX_KEY + appWidgetId, "");
        String noteTitle = prefs.getString(TodoWidgetConfigureActivity.PREF_TITLE_PREFIX_KEY + appWidgetId, "");

        // If not explicitly set, look up first checklist or fallback to default
        if (noteId.isEmpty()) {
            String allJson = prefs.getString(KEY_ALL_CHECKLISTS_JSON, "[]");
            try {
                JSONArray arr = new JSONArray(allJson);
                if (arr.length() > 0) {
                    JSONObject first = arr.getJSONObject(0);
                    noteId = first.optString("id", "");
                    noteTitle = first.optString("title", "To-Do List");
                }
            } catch (Exception ignored) {}

            if (noteId.isEmpty()) {
                noteId = prefs.getString(KEY_NOTE_ID, "");
                noteTitle = prefs.getString(KEY_NOTE_TITLE, "To-Do List");
            }
        }

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_todo_list);

        views.setTextViewText(R.id.widget_todo_title, (noteTitle == null || noteTitle.isEmpty()) ? "To-Do List" : noteTitle);

        // Open note intent
        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        if (!noteId.isEmpty()) {
            openIntent.putExtra("note_id", noteId);
            openIntent.setAction("com.ahmedfarook.notesapp.OPEN_NOTE");
        }

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent openPending = PendingIntent.getActivity(context, 100 + appWidgetId, openIntent, flags);
        views.setOnClickPendingIntent(R.id.widget_todo_root, openPending);
        views.setOnClickPendingIntent(R.id.widget_todo_header, openPending);
        views.setOnClickPendingIntent(R.id.widget_todo_empty, openPending);

        // Quick "+" button: opens lightweight floating QuickAddTaskActivity to add item directly without launching full app
        Intent addIntent = new Intent(context, QuickAddTaskActivity.class);
        addIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        addIntent.putExtra("note_id", noteId);
        addIntent.putExtra("note_title", (noteTitle == null || noteTitle.isEmpty()) ? "To-Do List" : noteTitle);
        addIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
        PendingIntent addPending = PendingIntent.getActivity(context, 200 + appWidgetId, addIntent, flags);
        views.setOnClickPendingIntent(R.id.widget_todo_btn_add, addPending);

        // Connect scrollable ListView via RemoteViewsService
        Intent serviceIntent = new Intent(context, TodoWidgetService.class);
        serviceIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
        serviceIntent.setData(Uri.parse(serviceIntent.toUri(Intent.URI_INTENT_SCHEME)));
        views.setRemoteAdapter(R.id.widget_todo_listview, serviceIntent);
        views.setEmptyView(R.id.widget_todo_listview, R.id.widget_todo_empty);

        // Set pending intent template for clickable rows in scrollable list
        Intent toggleIntent = new Intent(context, TodoWidget.class);
        toggleIntent.setAction(ACTION_TOGGLE_TODO);
        toggleIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);

        int templateFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            templateFlags |= PendingIntent.FLAG_MUTABLE;
        }
        PendingIntent togglePending = PendingIntent.getBroadcast(context, appWidgetId, toggleIntent, templateFlags);
        views.setPendingIntentTemplate(R.id.widget_todo_listview, togglePending);

        appWidgetManager.updateAppWidget(appWidgetId, views);
        appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetId, R.id.widget_todo_listview);
    }
}
