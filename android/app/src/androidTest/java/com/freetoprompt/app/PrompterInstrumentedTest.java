package com.freetoprompt.app;

import static androidx.test.espresso.Espresso.pressBack;
import static androidx.test.espresso.web.assertion.WebViewAssertions.webMatches;
import static androidx.test.espresso.web.sugar.Web.onWebView;
import static androidx.test.espresso.web.webdriver.DriverAtoms.*;
import static org.hamcrest.Matchers.containsString;
import static org.junit.Assert.*;

import android.content.Context;
import android.graphics.Bitmap;
import android.view.WindowManager;
import androidx.lifecycle.Lifecycle;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.espresso.web.webdriver.Locator;
import java.io.File;
import java.io.FileOutputStream;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONObject;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class PrompterInstrumentedTest {
    private Context context;

    @Before public void resetTestDraft() {
        context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE).edit().clear().commit();
    }

    private void awaitText(String id, String text) throws Exception {
        AssertionError last = null;
        for (int i = 0; i < 80; i++) {
            try {
                onWebView().withElement(findElement(Locator.ID, id))
                    .check(webMatches(getText(), containsString(text)));
                return;
            } catch (AssertionError e) { last = e; }
            catch (RuntimeException ignored) { /* WebView may still be attaching. */ }
            Thread.sleep(100);
        }
        if (last != null) throw last;
        fail("Timed out waiting for " + id + ": " + text);
    }

    private void click(String id) {
        onWebView().withElement(findElement(Locator.ID, id)).perform(webScrollIntoView()).perform(webClick());
    }

    private void awaitSaved(String expected) throws Exception {
        for (int i = 0; i < 80; i++) {
            String raw = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE).getString("prompter.v1", "{}");
            if (expected.equals(new JSONObject(raw).optString("text"))) return;
            Thread.sleep(100);
        }
        fail("Native draft was not persisted");
    }

    @Test public void editPersistsAcrossActivityRestart() throws Exception {
        String draft = "A saved native script. Your words. Your pace.";
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            awaitText("btnMode", "Play");
            onWebView().withElement(findElement(Locator.ID, "script")).perform(clearElement()).perform(webKeys(draft));
            awaitSaved(draft);
        }
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            awaitText("btnMode", "Play");
            click("btnMode");
            awaitText("content", draft);
            pressBack();
            awaitText("btnMode", "Play");
            click("btnReset");
            click("btnConfirmReset");
            awaitSaved("");
        }
    }

    @Test public void backgroundPausesAndBackReleasesScreenWake() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            awaitText("btnMode", "Play");
            click("btnMode");
            awaitText("btnPlay", "Pause");
            scenario.moveToState(Lifecycle.State.CREATED);
            scenario.moveToState(Lifecycle.State.RESUMED);
            awaitText("btnPlay", "Play");
            Bitmap screen = InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
            try (FileOutputStream out = new FileOutputStream(new File(context.getExternalFilesDir(null), "prompting.png"))) {
                assertTrue(screen.compress(Bitmap.CompressFormat.PNG, 100, out));
            }
            screen.recycle();
            pressBack();
            awaitText("btnMode", "Play");
            AtomicBoolean awake = new AtomicBoolean(true);
            for (int i = 0; i < 40; i++) {
                scenario.onActivity(activity -> awake.set((activity.getWindow().getAttributes().flags & WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) != 0));
                if (!awake.get()) break;
                Thread.sleep(100);
            }
            assertFalse("Editing should release the screen wake lock", awake.get());
        }
    }
}
