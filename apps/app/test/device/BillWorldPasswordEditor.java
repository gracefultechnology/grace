package technology.graceful.fixture;

import android.app.Instrumentation;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.graphics.Point;
import android.graphics.Rect;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.InputDevice;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.view.inspector.WindowInspector;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;

public final class BillWorldPasswordEditor extends Instrumentation {
  private static final String HOST = "technology.graceful.grace";
  private static final String[] FIELDS = {"label", "website", "username", "password"};

  @Override public void onCreate(Bundle arguments) {
    super.onCreate(arguments);
    start();
  }

  @Override public void onStart() {
    try {
      Context host = getTargetContext();
      if (!HOST.equals(host.getPackageName()) || (host.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) == 0) {
        throw new IllegalStateException();
      }
      JSONObject input;
      try (var stream = getContext().getAssets().open("synthetic-login.json")) {
        input = new JSONObject(new String(stream.readAllBytes(), StandardCharsets.UTF_8));
      }
      URI site = URI.create(input.getString("origin"));
      if (!"https".equals(site.getScheme()) || (!"localhost".equals(site.getHost()) && !"127.0.0.1".equals(site.getHost()))
          || site.getPort() < 1024 || site.getRawUserInfo() != null || !site.getRawPath().isEmpty()
          || site.getRawQuery() != null || site.getRawFragment() != null) throw new IllegalArgumentException();
      String[] values = {input.getString("label"), site.toString(), input.getString("username"), input.getString("password")};
      String[] labels = new String[FIELDS.length];
      for (int i = 0; i < FIELDS.length; i++) labels[i] = resource(host, "editor_" + FIELDS[i]);
      String title = resource(host, "editor_title");
      String save = resource(host, "save");
      KeyguardManager keyguard = host.getSystemService(KeyguardManager.class);
      if (keyguard == null || !keyguard.isDeviceSecure() || keyguard.isDeviceLocked()) throw new IllegalStateException();

      stage("ready");
      AtomicReference<Point> savePoint = new AtomicReference<>();
      long until = SystemClock.elapsedRealtime() + 900_000L;
      while (savePoint.get() == null && SystemClock.elapsedRealtime() < until) {
        runOnMainSync(() -> savePoint.set(fillOwnedDialog(host, labels, values, title, save)));
        if (savePoint.get() == null) SystemClock.sleep(50L);
      }
      Point point = savePoint.get();
      if (point == null) throw new IllegalStateException();
      long down = SystemClock.uptimeMillis();
      tap(point, down, MotionEvent.ACTION_DOWN);
      tap(point, down, MotionEvent.ACTION_UP);
      stage("save-dispatched");
      new CountDownLatch(1).await();
    } catch (Exception failed) {
      stage("failed");
      finish(0, new Bundle());
    }
  }

  private void tap(Point point, long down, int action) {
    MotionEvent event = MotionEvent.obtain(down, SystemClock.uptimeMillis(), action, point.x, point.y, 0);
    event.setSource(InputDevice.SOURCE_TOUCHSCREEN);
    try { sendPointerSync(event); }
    finally { event.recycle(); }
  }

  private void stage(String name) {
    Bundle status = new Bundle();
    status.putString("fixtureStage", name);
    sendStatus(0, status);
  }

  private static String resource(Context host, String name) {
    return host.getString(host.getResources().getIdentifier("eliza_passwords_" + name, "string", HOST));
  }

  private static Point fillOwnedDialog(Context host, String[] labels, String[] values, String title, String saveLabel) {
    for (View root : WindowInspector.getGlobalWindowViews()) {
      if (!HOST.equals(root.getContext().getPackageName()) || !root.hasWindowFocus() || !root.isShown()) continue;
      if (!(root.getLayoutParams() instanceof WindowManager.LayoutParams layout)
          || (layout.flags & WindowManager.LayoutParams.FLAG_SECURE) == 0) continue;
      int titleId = host.getResources().getIdentifier("alertTitle", "id", "android");
      if (!(root.findViewById(titleId) instanceof TextView heading) || !title.contentEquals(heading.getText())) continue;
      if (!(root.findViewById(android.R.id.button1) instanceof Button save) || !save.isEnabled()
          || !save.isShown() || !saveLabel.equalsIgnoreCase(save.getText().toString())) continue;

      var inputs = new ArrayList<EditText>();
      var remaining = new ArrayDeque<View>();
      remaining.add(root);
      while (!remaining.isEmpty()) {
        View view = remaining.removeFirst();
        if (view instanceof EditText input && input.isEnabled() && input.isShown()
            && input.getFilterTouchesWhenObscured()) inputs.add(input);
        if (view instanceof ViewGroup group) {
          for (int i = 0; i < group.getChildCount(); i++) remaining.addLast(group.getChildAt(i));
        }
      }
      var fields = new ArrayList<EditText>();
      for (String label : labels) {
        EditText match = null;
        for (EditText input : inputs) {
          CharSequence description = input.getContentDescription();
          if (description == null || !label.contentEquals(description)) continue;
          if (match != null) return null;
          match = input;
        }
        if (match == null) return null;
        fields.add(match);
      }
      for (int i = 0; i < values.length; i++) {
        EditText field = fields.get(i);
        if (!field.requestFocus() || !field.hasFocus() || !root.hasWindowFocus()) return null;
        field.setText(values[i]);
      }
      Rect bounds = new Rect();
      if (!root.hasWindowFocus() || !save.getLocalVisibleRect(bounds) || bounds.isEmpty()) return null;
      int[] location = new int[2];
      save.getLocationOnScreen(location);
      return new Point(location[0] + bounds.centerX(), location[1] + bounds.centerY());
    }
    return null;
  }
}
