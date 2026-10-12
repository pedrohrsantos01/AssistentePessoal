package dev.ritmo.readerobserver;

import android.app.Instrumentation;
import android.app.UiAutomation;
import android.graphics.Rect;
import android.os.Bundle;
import android.view.accessibility.AccessibilityNodeInfo;
import android.util.Xml;
import java.io.StringWriter;
import java.util.ArrayDeque;
import org.xmlpull.v1.XmlSerializer;

/** Read-only observer of the synthetic journey; runs in its own package/process. */
public final class ReaderObserver extends Instrumentation {
    @Override public void onCreate(Bundle arguments) { super.onCreate(arguments); start(); }
    @Override public void onStart() {
        Bundle result = new Bundle();
        UiAutomation automation = null;
        try {
            automation = getUiAutomation(UiAutomation.FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES);
            AccessibilityNodeInfo root = automation.getRootInActiveWindow();
            if (root == null || !"dev.ritmo.journeytest".contentEquals(root.getPackageName())) {
                throw new IllegalStateException("synthetic_journey_not_foreground");
            }
            StringWriter writer = new StringWriter();
            XmlSerializer xml = Xml.newSerializer();
            xml.setOutput(writer);
            xml.startTag(null, "hierarchy");
            ArrayDeque<AccessibilityNodeInfo> pending = new ArrayDeque<>();
            pending.add(root);
            int count = 0;
            while (!pending.isEmpty()) {
                if (++count > 2000) throw new IllegalStateException("hierarchy_limit");
                AccessibilityNodeInfo node = pending.removeFirst();
                Rect bounds = new Rect();
                node.getBoundsInScreen(bounds);
                xml.startTag(null, "node");
                xml.attribute(null, "package", text(node.getPackageName()));
                xml.attribute(null, "class", text(node.getClassName()));
                xml.attribute(null, "text", text(node.getText()));
                xml.attribute(null, "content-desc", text(node.getContentDescription()));
                xml.attribute(null, "bounds", "["+bounds.left+","+bounds.top+"]["+bounds.right+","+bounds.bottom+"]");
                xml.attribute(null, "checked", Boolean.toString(node.isChecked()));
                xml.attribute(null, "checkable", Boolean.toString(node.isCheckable()));
                xml.attribute(null, "clickable", Boolean.toString(node.isClickable()));
                xml.attribute(null, "enabled", Boolean.toString(node.isEnabled()));
                xml.attribute(null, "scrollable", Boolean.toString(node.isScrollable()));
                xml.attribute(null, "accessibility-focused", Boolean.toString(node.isAccessibilityFocused()));
                xml.endTag(null, "node");
                for (int i=0;i<node.getChildCount();i++) {
                    AccessibilityNodeInfo child = node.getChild(i);
                    if (child != null) pending.addLast(child);
                }
            }
            xml.endTag(null, "hierarchy");
            xml.flush();
            result.putString("hierarchy", writer.toString());
            finish(0, result);
        } catch (Exception error) {
            result.putString("observer_error", error.getClass().getSimpleName());
            finish(1, result);
        }
    }
    private static String text(CharSequence value) { return value == null ? "" : value.toString(); }
}
