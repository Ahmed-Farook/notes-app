package com.ahmedfarook.notesapp;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Build;
import android.text.SpannableString;
import android.text.style.StrikethroughSpan;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

public class TodoWidget extends AppWidgetProvider {

    public static final String ACTION_TOGGLE_TODO = "com.ahmedfarook.notesapp.ACTION_TOGGLE_TODO";
    public static final String PREFS_NAME = "texo_widget_prefs";
    public static final String KEY_NOTE_ID = "widget_note_id";
    public static final String KEY_NOTE_TITLE = "widget_note_title";
    public static final String KEY_ITEMS_JSON = "widget_items_json";
    public static final String KEY_PENDING_TOGGLES = "widget_pending_toggles";

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);

        if (ACTION_TOGGLE_TODO.equals(intent.getAction())) {
            int itemIndex = intent.getIntExtra("item_index", -1);
            String noteId = intent.getStringExtra("note_id");

            if (itemIndex >= 0) {
                toggleTodoItem(context, noteId, itemIndex);
            }
        }
    }

    private void toggleTodoItem(Context context, String noteId, int itemIndex) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String itemsJsonStr = prefs.getString(KEY_ITEMS_JSON, "[]");

        try {
            JSONArray items = new JSONArray(itemsJsonStr);
            if (itemIndex < items.length()) {
                JSONObject item = items.getJSONObject(itemIndex);
                boolean current = item.optBoolean("checked", false);
                boolean next = !current;
                item.put("checked", next);

                // Save updated items back to preferences
                SharedPreferences.Editor editor = prefs.edit();
                editor.putString(KEY_ITEMS_JSON, items.toString());

                // Record pending toggle event so web app can sync it when opened
                JSONArray pending;
                String pendingStr = prefs.getString(KEY_PENDING_TOGGLES, "[]");
                try {
                    pending = new JSONArray(pendingStr);
                } catch (Exception e) {
                    pending = new JSONArray();
                }

                JSONObject toggleEvent = new JSONObject();
                toggleEvent.put("noteId", noteId);
                toggleEvent.put("itemIndex", itemIndex);
                toggleEvent.put("checked", next);
                toggleEvent.put("timestamp", System.currentTimeMillis());
                pending.put(toggleEvent);

                editor.putString(KEY_PENDING_TOGGLES, pending.toString());
                editor.apply();

                // Refresh all widget instances immediately
                AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
                ComponentName thisWidget = new ComponentName(context, TodoWidget.class);
                int[] appWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget);
                onUpdate(context, appWidgetManager, appWidgetIds);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String noteId = prefs.getString(KEY_NOTE_ID, "");
        String noteTitle = prefs.getString(KEY_NOTE_TITLE, "To-Do List");
        String itemsJsonStr = prefs.getString(KEY_ITEMS_JSON, "[]");

        JSONArray items;
        try {
            items = new JSONArray(itemsJsonStr);
        } catch (Exception e) {
            items = new JSONArray();
        }

        for (int appWidgetId : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_todo_list);

            views.setTextViewText(R.id.widget_todo_title, noteTitle.isEmpty() ? "To-Do List" : noteTitle);

            // Intent to open the specific note inside Texo
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

            // Intent for quick "+" button to add a checklist item or create a note
            Intent addIntent = new Intent(context, MainActivity.class);
            addIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            if (!noteId.isEmpty()) {
                addIntent.setAction("com.ahmedfarook.notesapp.ADD_CHECKLIST_ITEM");
                addIntent.putExtra("action", "add_checklist_item");
                addIntent.putExtra("note_id", noteId);
            } else {
                addIntent.setAction(QuickNoteWidget.ACTION_NEW_NOTE);
                addIntent.putExtra("action", "new_note");
            }
            PendingIntent addPending = PendingIntent.getActivity(context, 200 + appWidgetId, addIntent, flags);
            views.setOnClickPendingIntent(R.id.widget_todo_btn_add, addPending);

            // Clear previously rendered dynamic checklist rows
            views.removeAllViews(R.id.widget_todo_items_container);

            if (items.length() == 0) {
                views.setViewVisibility(R.id.widget_todo_empty, View.VISIBLE);
                views.setViewVisibility(R.id.widget_todo_items_container, View.GONE);
            } else {
                views.setViewVisibility(R.id.widget_todo_empty, View.GONE);
                views.setViewVisibility(R.id.widget_todo_items_container, View.VISIBLE);

                int maxItems = Math.min(items.length(), 10);
                for (int i = 0; i < maxItems; i++) {
                    try {
                        JSONObject item = items.getJSONObject(i);
                        String text = item.optString("text", "");
                        boolean checked = item.optBoolean("checked", false);

                        RemoteViews itemViews = new RemoteViews(context.getPackageName(), R.layout.widget_todo_item);

                        if (checked) {
                            itemViews.setImageViewResource(R.id.widget_todo_item_check, R.drawable.widget_checkbox_checked);
                            SpannableString span = new SpannableString(text);
                            span.setSpan(new StrikethroughSpan(), 0, text.length(), 0);
                            itemViews.setTextViewText(R.id.widget_todo_item_text, span);
                            itemViews.setTextColor(R.id.widget_todo_item_text, Color.parseColor("#8AA0B4"));
                        } else {
                            itemViews.setImageViewResource(R.id.widget_todo_item_check, R.drawable.widget_checkbox_unchecked);
                            itemViews.setTextViewText(R.id.widget_todo_item_text, text);
                            itemViews.setTextColor(R.id.widget_todo_item_text, Color.parseColor("#1C2B36"));
                        }

                        // Broadcast PendingIntent when tapping this item
                        Intent toggleIntent = new Intent(context, TodoWidget.class);
                        toggleIntent.setAction(ACTION_TOGGLE_TODO);
                        toggleIntent.putExtra("note_id", noteId);
                        toggleIntent.putExtra("item_index", i);

                        int itemFlags = PendingIntent.FLAG_UPDATE_CURRENT;
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            itemFlags |= PendingIntent.FLAG_IMMUTABLE;
                        }

                        PendingIntent togglePending = PendingIntent.getBroadcast(
                                context,
                                (appWidgetId * 1000) + i,
                                toggleIntent,
                                itemFlags
                        );

                        itemViews.setOnClickPendingIntent(R.id.widget_todo_item_row, togglePending);

                        views.addView(R.id.widget_todo_items_container, itemViews);
                    } catch (Exception ignored) {}
                }
            }

            appWidgetManager.updateAppWidget(appWidgetId, views);
        }
    }
}

