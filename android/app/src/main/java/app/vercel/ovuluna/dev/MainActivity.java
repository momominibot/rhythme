package app.vercel.ovuluna.dev;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // Health Connect opens the app with one of these when someone taps "why" or the privacy policy link
    private static final String SHOW_RATIONALE = "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE";
    private static final String VIEW_USAGE = "android.intent.action.VIEW_PERMISSION_USAGE";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // plugins that live in this app rather than in an npm package register before the bridge starts
        registerPlugin(RhythmeHealthPlugin.class);
        super.onCreate(savedInstanceState);
        showPrivacyIfAsked(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        showPrivacyIfAsked(intent);
    }

    private void showPrivacyIfAsked(Intent intent) {
        if (intent == null || bridge == null) return;
        String action = intent.getAction();
        if (!SHOW_RATIONALE.equals(action) && !VIEW_USAGE.equals(action)) return;
        bridge.getWebView().post(() -> bridge.getWebView().loadUrl(bridge.getLocalUrl() + "/privacy.html"));
    }
}
