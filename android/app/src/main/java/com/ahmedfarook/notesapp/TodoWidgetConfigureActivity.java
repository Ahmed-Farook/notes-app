package com.ahmedfarook.notesapp;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.Button;
import android.widget.ListView;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

public class TodoWidgetConfigureActivity extends Activity {

    public static final String PREF_PREFIX_KEY = "widget_note_id_";
    public static final String PREF_TITLE_PREFIX_KEY = "widget_note_title_";

    private int mAppWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID;

    private static class ChecklistOption {
        String id;
        String title;
        int taskCount;

        ChecklistOption(String id, String title, int taskCount) {
            this.id = id;
            this.title = title;
            this.taskCount = taskCount;
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Set result to CANCELED so if the user backs out, the widget is not created
        setResult(RESULT_CANCELED);

        setContentView(R.layout.activity_widget_configure);

        // Find widget id from incoming intent
        Intent intent = getIntent();
        Bundle extras = intent.getExtras();
        if (extras != null) {
            mAppWidgetId = extras.getInt(
                    AppWidgetManager.EXTRA_APPWIDGET_ID,
                    AppWidgetManager.INVALID_APPWIDGET_ID
            );
        }

        if (mAppWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish();
            return;
        }

        ListView listView = findViewById(R.id.config_checklist_list);
        View emptyState = findViewById(R.id.config_empty_state);
        Button btnOpenTexo = findViewById(R.id.btn_open_texo);
        Button btnCancel = findViewById(R.id.btn_cancel_config);

        btnCancel.setOnClickListener(v -> finish());
        btnOpenTexo.setOnClickListener(v -> {
            Intent launch = new Intent(this, MainActivity.class);
            launch.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(launch);
            finish();
        });

        // Load checklists from SharedPreferences
        SharedPreferences prefs = getSharedPreferences(TodoWidget.PREFS_NAME, Context.MODE_PRIVATE);
        String allJson = prefs.getString(TodoWidget.KEY_ALL_CHECKLISTS_JSON, "[]");

        List<ChecklistOption> options = new ArrayList<>();
        try {
            JSONArray arr = new JSONArray(allJson);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.getJSONObject(i);
                String id = obj.optString("id", "");
                String title = obj.optString("title", "To-Do List");
                JSONArray items = obj.optJSONArray("items");
                int count = items != null ? items.length() : 0;
                if (!id.isEmpty()) {
                    options.add(new ChecklistOption(id, title, count));
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        // Fallback: If no structured allChecklists, check single default note
        if (options.isEmpty()) {
            String defaultId = prefs.getString(TodoWidget.KEY_NOTE_ID, "");
            String defaultTitle = prefs.getString(TodoWidget.KEY_NOTE_TITLE, "To-Do List");
            if (!defaultId.isEmpty()) {
                options.add(new ChecklistOption(defaultId, defaultTitle, 0));
            }
        }

        if (options.isEmpty()) {
            emptyState.setVisibility(View.VISIBLE);
            listView.setVisibility(View.GONE);
        } else {
            emptyState.setVisibility(View.GONE);
            listView.setVisibility(View.VISIBLE);

            ChecklistAdapter adapter = new ChecklistAdapter(this, options);
            listView.setAdapter(adapter);

            listView.setOnItemClickListener((parent, view, position, id) -> {
                ChecklistOption chosen = options.get(position);

                // Save selected note ID for this widget
                SharedPreferences.Editor editor = prefs.edit();
                editor.putString(PREF_PREFIX_KEY + mAppWidgetId, chosen.id);
                editor.putString(PREF_TITLE_PREFIX_KEY + mAppWidgetId, chosen.title);
                editor.apply();

                // Trigger widget update
                AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(this);
                TodoWidget.updateAppWidget(this, appWidgetManager, mAppWidgetId);

                // Return OK result with widget ID
                Intent resultValue = new Intent();
                resultValue.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, mAppWidgetId);
                setResult(RESULT_OK, resultValue);
                finish();
            });
        }
    }

    private static class ChecklistAdapter extends BaseAdapter {
        private final Context context;
        private final List<ChecklistOption> items;

        ChecklistAdapter(Context context, List<ChecklistOption> items) {
            this.context = context;
            this.items = items;
        }

        @Override
        public int getCount() {
            return items.size();
        }

        @Override
        public Object getItem(int position) {
            return items.get(position);
        }

        @Override
        public long getItemId(int position) {
            return position;
        }

        @Override
        public View getView(int position, View convertView, ViewGroup parent) {
            if (convertView == null) {
                convertView = LayoutInflater.from(context).inflate(R.layout.item_configure_checklist, parent, false);
            }

            ChecklistOption item = items.get(position);
            TextView titleView = convertView.findViewById(R.id.item_checklist_title);
            TextView subtitleView = convertView.findViewById(R.id.item_checklist_subtitle);

            titleView.setText(item.title);
            subtitleView.setText(item.taskCount + (item.taskCount == 1 ? " task" : " tasks"));

            return convertView;
        }
    }
}

