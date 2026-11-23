// spec/app/setup.md, "Subscription actions belong to the Grace account that is signed in"
package technology.graceful.grace;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Handler;
import android.os.Looper;
import androidx.core.content.ContextCompat;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

public final class GraceDeviceLeaseJob extends JobService {
 private static final int JOB_ID = 0x47524c;
 private static final String LEASE_CHANGED = BuildConfig.APPLICATION_ID + ".LEASE_CHANGED";
 private final Handler main = new Handler(Looper.getMainLooper());
 private final ExecutorService worker = Executors.newSingleThreadExecutor();
 private JobParameters running;
 private Future<?> task;

 static void schedule(Context context) {
  JobScheduler scheduler = context.getSystemService(JobScheduler.class);
  if (scheduler == null || scheduler.getPendingJob(JOB_ID) != null) return;
  scheduler.schedule(new JobInfo.Builder(JOB_ID, new ComponentName(context, GraceDeviceLeaseJob.class))
    .setPersisted(true)
    .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
    .setPeriodic(TimeUnit.HOURS.toMillis(6))
    .build());
 }

 static void leaseChanged(Context context) {
  context.sendBroadcast(new Intent(LEASE_CHANGED).setPackage(context.getPackageName()));
 }

 static Runnable listen(Context context, Runnable changed) {
  var receiver = new BroadcastReceiver() {
   @Override public void onReceive(Context source, Intent intent) { changed.run(); }
  };
  ContextCompat.registerReceiver(context, receiver, new IntentFilter(LEASE_CHANGED), ContextCompat.RECEIVER_NOT_EXPORTED);
  return () -> context.unregisterReceiver(receiver);
 }

 @Override public boolean onStartJob(JobParameters params) {
  running = params;
  task = worker.submit(() -> {
   boolean retry = false;
   try { GraceAccount.maintainDeviceLease(getApplicationContext()); }
   catch (Exception unavailable) { retry = true; }
   boolean needsRetry = retry;
   main.post(() -> {
    if (running != params) return;
    running = null;
    task = null;
    jobFinished(params, needsRetry);
   });
  });
  return true;
 }

 @Override public boolean onStopJob(JobParameters params) {
  if (running == null || running.getJobId() != params.getJobId()) return false;
  running = null;
  if (task != null) task.cancel(true);
  task = null;
  return true;
 }

 @Override public void onDestroy() {
  running = null;
  worker.shutdownNow();
  super.onDestroy();
 }
}
