package com.kadhali.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraManager;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognizerIntent;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.view.Gravity;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.Toast;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

public class MainActivity extends Activity {
    private static final int REQ_SPEECH = 1001;
    private static final int REQ_MIC = 1002;
    private WebView web;
    private SharedPreferences prefs;
    private TextToSpeech tts;
    private ProgressBar bar;
    private String speechLang = "en-US";

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        prefs = getSharedPreferences("kadhali", MODE_PRIVATE);

        FrameLayout root = new FrameLayout(this);
        web = new WebView(this);
        root.addView(web);
        bar = new ProgressBar(this);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(130, 130);
        lp.gravity = Gravity.CENTER;
        bar.setLayoutParams(lp);
        root.addView(bar);
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        try { s.setAllowUniversalAccessFromFileURLs(true); } catch (Throwable ignored) {}
        try { s.setAllowFileAccessFromFileURLs(true); } catch (Throwable ignored) {}
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        try { WebView.setWebContentsDebuggingEnabled(true); } catch (Throwable ignored) {}

        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(final PermissionRequest r) {
                runOnUiThread(new Runnable() { public void run() { r.grant(r.getResources()); } });
            }
        });
        web.setWebViewClient(new WebViewClient() {
            @Override public void onPageFinished(WebView v, String url) { bar.setVisibility(View.GONE); }
            @Override public void onReceivedError(WebView v, WebResourceRequest req, WebResourceError e) {
                if (req != null && req.isForMainFrame()) {
                    bar.setVisibility(View.GONE);
                    askServer(getString(R.string.app_name) + " server reachable illa.\n" + e.getDescription());
                }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                String u = req.getUrl().toString();
                if (u.startsWith("http://") || u.startsWith("https://")) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, req.getUrl())); } catch (Throwable ignored) {}
                return true;
            }
        });

        tts = new TextToSpeech(this, new TextToSpeech.OnInitListener() {
            @Override public void onInit(int status) {
                if (status == TextToSpeech.SUCCESS) setupTts();
            }
        });

        load("file:///android_asset/web/index.html");
    }

    private void setupTts() {
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String id) {}
            @Override public void onDone(String id) { callJs("window.__androidSpeakEnd&&window.__androidSpeakEnd()"); }
            @Override public void onError(String id) { callJs("window.__androidSpeakEnd&&window.__androidSpeakEnd()"); }
        });
    }

    private void chooseFemaleVoice(String lang) {
        if (Build.VERSION.SDK_INT < 21 || tts == null) return;
        try {
            String prefix = lang == null ? "en" : lang.split("-")[0].toLowerCase();
            java.util.Set<android.speech.tts.Voice> vs = tts.getVoices();
            if (vs == null) return;
            android.speech.tts.Voice best = null;
            for (android.speech.tts.Voice v : vs) {
                if (v.getLocale() == null) continue;
                if (!v.getLocale().getLanguage().toLowerCase().startsWith(prefix)) continue;
                String n = v.getName().toLowerCase();
                if (n.contains("female") || n.contains("f00") || n.contains("sft") || n.contains("woman")) { best = v; break; }
                if (best == null) best = v;
            }
            if (best != null) tts.setVoice(best);
        } catch (Throwable ignored) {}
    }

    private void load(String url) {
        bar.setVisibility(View.VISIBLE);
        web.loadUrl(url);
    }

    private void askServer(String msg) {
        final EditText input = new EditText(this);
        input.setHint("http://192.168.1.10:8765");
        input.setText(prefs.getString("server", "http://192.168.1.100:8765"));
        input.setSingleLine(true);
        new AlertDialog.Builder(this)
            .setTitle("Kadhali server")
            .setMessage(msg == null ? "Enter the URL shown by run.sh on your computer (same Wi-Fi)." : msg)
            .setView(input)
            .setCancelable(false)
            .setPositiveButton("Connect", new android.content.DialogInterface.OnClickListener() {
                @Override public void onClick(android.content.DialogInterface d, int w) {
                    String u = input.getText().toString().trim();
                    if (u.isEmpty()) return;
                    if (!u.startsWith("http")) u = "http://" + u;
                    if (u.endsWith("/")) u = u.substring(0, u.length() - 1);
                    prefs.edit().putString("server", u).apply();
                    load("file:///android_asset/web/index.html");
                }
            })
            .setNegativeButton("Exit", new android.content.DialogInterface.OnClickListener() {
                @Override public void onClick(android.content.DialogInterface d, int w) { finish(); }
            })
            .show();
    }

    private void callJs(final String js) {
        runOnUiThread(new Runnable() { public void run() { try { web.evaluateJavascript(js, null); } catch (Throwable ignored) {} } });
    }

    private void startVoice() {
        if (Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_MIC);
            return;
        }
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, speechLang);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, speechLang);
        i.putExtra(RecognizerIntent.EXTRA_PROMPT, "Speak to Kadhali…");
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
        try {
            startActivityForResult(i, REQ_SPEECH);
        } catch (Throwable t) {
            Toast.makeText(this, "No speech recognizer installed (install Google app)", Toast.LENGTH_LONG).show();
        }
    }

    @Override public void onRequestPermissionsResult(int req, String[] perms, int[] res) {
        super.onRequestPermissionsResult(req, perms, res);
        if (req == REQ_MIC && res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED) startVoice();
        else if (req == REQ_MIC) Toast.makeText(this, "Microphone permission needed", Toast.LENGTH_LONG).show();
    }

    @Override protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req == REQ_SPEECH && res == RESULT_OK && data != null) {
            ArrayList<String> r = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            if (r != null && !r.isEmpty()) {
                String text = r.get(0);
                callJs("window.__androidSpeech&&window.__androidSpeech(" + JSONObject.quote(text) + ")");
            }
        }
    }

    private boolean torchOn = false;
    private String torchId = null;

    class Bridge {
        @JavascriptInterface public String getServer() { return prefs.getString("server", ""); }
        @JavascriptInterface public String getVersion() { return "1.0"; }
        @JavascriptInterface public void setServer(String url) {
            if (url == null) return;
            url = url.trim();
            if (url.isEmpty()) return;
            if (!url.startsWith("http")) url = "http://" + url;
            if (url.endsWith("/")) url = url.substring(0, url.length() - 1);
            prefs.edit().putString("server", url).apply();
            callJs("window.__kadhaliServer&&window.__kadhaliServer(" + JSONObject.quote(url) + ")");
        }
        @JavascriptInterface public void startListening(String lang) {
            speechLang = (lang == null || lang.isEmpty()) ? "en-US" : lang;
            runOnUiThread(new Runnable() { public void run() { startVoice(); } });
        }
        @JavascriptInterface public void stopListening() {}
        @JavascriptInterface public void speak(final String text, final String lang, final float rate, final float pitch) {
            runOnUiThread(new Runnable() {
                public void run() {
                    if (tts == null) return;
                    try {
                        Locale loc = Locale.forLanguageTag((lang == null || lang.isEmpty()) ? "en-US" : lang);
                        chooseFemaleVoice(lang);
                        tts.setLanguage(loc);
                        tts.setSpeechRate(rate <= 0 ? 1f : rate);
                        tts.setPitch(pitch <= 0 ? 1f : pitch);
                        tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "k" + System.currentTimeMillis());
                    } catch (Throwable ignored) {}
                }
            });
        }
        @JavascriptInterface public String getControlToken() { return prefs.getString("controlToken", ""); }
        @JavascriptInterface public void setControlToken(String t) {
            if (t != null) prefs.edit().putString("controlToken", t.trim()).apply();
        }
        @JavascriptInterface public String deviceInfo() {
            try {
                JSONObject j = new JSONObject();
                j.put("model", Build.MODEL == null ? "" : Build.MODEL);
                j.put("brand", Build.BRAND == null ? "" : Build.BRAND);
                j.put("android", Build.VERSION.RELEASE == null ? "" : Build.VERSION.RELEASE);
                j.put("sdk", Build.VERSION.SDK_INT);
                int level = -1, scale = 100;
                boolean charging = false;
                Intent b = registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
                if (b != null) {
                    level = b.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
                    scale = b.getIntExtra(BatteryManager.EXTRA_SCALE, 100);
                    int st = b.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
                    charging = st == BatteryManager.BATTERY_STATUS_CHARGING || st == BatteryManager.BATTERY_STATUS_FULL;
                }
                j.put("battery", level < 0 ? -1 : Math.round(level * 100f / (scale <= 0 ? 100 : scale)));
                j.put("charging", charging);
                return j.toString();
            } catch (Throwable t) { return "{}"; }
        }
        @JavascriptInterface public String toggleTorch() {
            try {
                CameraManager cm = (CameraManager) getSystemService(Context.CAMERA_SERVICE);
                if (cm == null) return "0";
                if (torchId == null) {
                    String[] ids = cm.getCameraIdList();
                    for (String id : ids) {
                        Boolean flash = cm.getCameraCharacteristics(id).get(CameraCharacteristics.FLASH_INFO_AVAILABLE);
                        if (flash != null && flash) { torchId = id; break; }
                    }
                }
                if (torchId == null) return "0";
                torchOn = !torchOn;
                cm.setTorchMode(torchId, torchOn);
                return torchOn ? "1" : "0";
            } catch (Throwable t) { return "0"; }
        }
        @JavascriptInterface public void vibrate(final int ms) {
            runOnUiThread(new Runnable() { public void run() {
                try {
                    Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                    if (v == null) return;
                    int d = ms <= 0 ? 200 : ms;
                    if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(d, VibrationEffect.DEFAULT_AMPLITUDE));
                    else v.vibrate(d);
                } catch (Throwable ignored) {}
            }});
        }
        @JavascriptInterface public void setClipboard(final String text) {
            runOnUiThread(new Runnable() { public void run() {
                try {
                    ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                    if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("Kadhali", text == null ? "" : text));
                } catch (Throwable ignored) {}
            }});
        }
        @JavascriptInterface public String getClipboard() {
            final String[] out = new String[]{""};
            final CountDownLatch done = new CountDownLatch(1);
            runOnUiThread(new Runnable() { public void run() {
                try {
                    ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                    if (cm != null && cm.hasPrimaryClip() && cm.getPrimaryClip() != null && cm.getPrimaryClip().getItemCount() > 0) {
                        CharSequence t = cm.getPrimaryClip().getItemAt(0).coerceToText(MainActivity.this);
                        if (t != null) out[0] = t.toString();
                    }
                } catch (Throwable ignored) {}
                done.countDown();
            }});
            try { done.await(700, TimeUnit.MILLISECONDS); } catch (Throwable ignored) {}
            return out[0];
        }
        @JavascriptInterface public void share(final String text) {
            runOnUiThread(new Runnable() { public void run() {
                try {
                    Intent i = new Intent(Intent.ACTION_SEND);
                    i.setType("text/plain");
                    i.putExtra(Intent.EXTRA_TEXT, text == null ? "" : text);
                    startActivity(Intent.createChooser(i, "Share with"));
                } catch (Throwable ignored) {}
            }});
        }
        @JavascriptInterface public void openSettings(String which) {
            String a = Settings.ACTION_SETTINGS;
            String w = which == null ? "" : which;
            if ("wifi".equals(w)) a = Settings.ACTION_WIFI_SETTINGS;
            else if ("bluetooth".equals(w)) a = Settings.ACTION_BLUETOOTH_SETTINGS;
            else if ("display".equals(w)) a = Settings.ACTION_DISPLAY_SETTINGS;
            else if ("sound".equals(w)) a = Settings.ACTION_SOUND_SETTINGS;
            else if ("battery".equals(w)) a = "android.settings.BATTERY_SAVER_SETTINGS";
            else if ("app".equals(w)) a = Settings.ACTION_APPLICATION_DETAILS_SETTINGS;
            try {
                Intent i = "app".equals(w)
                    ? new Intent(a, Uri.parse("package:" + getPackageName()))
                    : new Intent(a);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i);
            } catch (Throwable t) {
                try { startActivity(new Intent(Settings.ACTION_SETTINGS)); } catch (Throwable ignored) {}
            }
        }
        @JavascriptInterface public void stopSpeaking() {
            runOnUiThread(new Runnable() { public void run() { if (tts != null) tts.stop(); } });
        }
    }

    @Override public void onBackPressed() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        if (tts != null) { try { tts.stop(); tts.shutdown(); } catch (Throwable ignored) {} }
        if (web != null) { web.destroy(); }
        super.onDestroy();
    }
}
