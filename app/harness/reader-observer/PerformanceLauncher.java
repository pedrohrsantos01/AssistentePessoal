package dev.ritmo.readerobserver;

import android.app.Instrumentation;
import android.content.ComponentName;
import android.content.Intent;
import android.os.Bundle;
import android.os.Process;

/** Device-side clock immediately before an isolated Activity launch; no UI or network. */
public final class PerformanceLauncher extends Instrumentation {
    private int sample;
    @Override public void onCreate(Bundle arguments) {
        super.onCreate(arguments);
        String target = arguments == null ? "" : arguments.getString("targetPackage", "");
        try { sample = Integer.parseInt(arguments == null ? "0" : arguments.getString("sample", "0")); }
        catch (NumberFormatException ignored) { sample = 0; }
        if (!"dev.ritmo.readonlytest".equals(target) || sample < 1 || sample > 10) {
            Bundle result = new Bundle(); result.putString("launcher_error", "isolated_performance_target_required"); finish(1, result); return;
        }
        start();
    }
    @Override public void onStart() {
        Bundle result = new Bundle();
        try {
            int launcherPid = Process.myPid();
            Intent intent = new Intent(Intent.ACTION_MAIN).setComponent(new ComponentName("dev.ritmo.readonlytest", "dev.ritmo.readonlytest.MainActivity"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK).putExtra("ritmoPerfSample", sample).putExtra("ritmoPerfOriginPid", launcherPid);
            long launchNs = System.nanoTime();
            intent.putExtra("ritmoPerfLaunchNs", launchNs);
            getTargetContext().startActivity(intent);
            result.putLong("launchNs", launchNs); result.putInt("launcherPid", launcherPid); result.putInt("sample", sample);
            result.putString("clock", "device_intent_request");
            finish(0, result);
        } catch (RuntimeException error) {
            result.putString("launcher_error", error.getClass().getSimpleName()); finish(1, result);
        }
    }
}
