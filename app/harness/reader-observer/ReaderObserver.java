package dev.ritmo.readerobserver;

import android.app.Instrumentation;
import android.app.UiAutomation;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.view.accessibility.AccessibilityWindowInfo;
import android.graphics.Rect;
import android.os.Bundle;
import android.view.accessibility.AccessibilityNodeInfo;
import android.util.Xml;
import java.io.StringWriter;
import java.util.ArrayDeque;
import java.util.ArrayList;
import org.xmlpull.v1.XmlSerializer;

/** Read-only observer of the synthetic journey; runs in its own package/process. */
public final class ReaderObserver extends Instrumentation {
    private String targetPackage;
    @Override public void onCreate(Bundle arguments) {
        super.onCreate(arguments);
        targetPackage = arguments == null ? "dev.ritmo.journeytest" : arguments.getString("targetPackage", "dev.ritmo.journeytest");
        if (!"dev.ritmo.journeytest".equals(targetPackage) && !"dev.ritmo.readonlytest".equals(targetPackage)) {
            Bundle result = new Bundle(); result.putString("observer_error", "synthetic_target_required"); finish(1, result); return;
        }
        start();
    }
    @Override public void onStart() {
        Bundle result = new Bundle();
        UiAutomation automation = null;
        try {
            automation = getUiAutomation(UiAutomation.FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES);
            AccessibilityServiceInfo info = automation.getServiceInfo();
            info.flags |= AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS;
            automation.setServiceInfo(info);
            var windows = new ArrayList<AccessibilityWindowInfo>();
            var roots = new ArrayList<AccessibilityNodeInfo>();
            Rect imeBounds = new Rect();
            boolean imeVisible = false, firstApplication = true;
            int focusedWindow = -1;
            // Android returns interactive windows in descending layer order. A blocked
            // background may be omitted entirely; collect every returned own-app root.
            // Other apps/system windows contribute no content; the IME contributes geometry only.
            for (AccessibilityWindowInfo window : automation.getWindows()) {
                if (window.isAccessibilityFocused()) focusedWindow = window.getId();
                if (window.getType() == AccessibilityWindowInfo.TYPE_INPUT_METHOD) {
                    imeVisible = true; window.getBoundsInScreen(imeBounds);
                } else if (window.getType() == AccessibilityWindowInfo.TYPE_APPLICATION) {
                    AccessibilityNodeInfo candidate = window.getRoot();
                    boolean own = candidate != null && targetPackage.contentEquals(candidate.getPackageName());
                    if (firstApplication && !own) throw new IllegalStateException("synthetic_journey_not_foreground");
                    firstApplication = false;
                    if (own) {windows.add(window); roots.add(candidate);}
                }
            }
            if (roots.isEmpty() || roots.size() > 16) throw new IllegalStateException("synthetic_journey_not_foreground");
            StringWriter writer = new StringWriter();
            XmlSerializer xml = Xml.newSerializer();
            xml.setOutput(writer);
            xml.startTag(null, "hierarchy");
            xml.attribute(null, "ime-visible", Boolean.toString(imeVisible));
            xml.attribute(null, "ime-bounds", "["+imeBounds.left+","+imeBounds.top+"]["+imeBounds.right+","+imeBounds.bottom+"]");
            xml.attribute(null, "focused-window-id", Integer.toString(focusedWindow));
            xml.attribute(null, "application-window-count", Integer.toString(windows.size()));
            int count = 0;
            for (int index = 0; index < windows.size(); index++) {
                AccessibilityWindowInfo window = windows.get(index);
                xml.startTag(null, "window");
                xml.attribute(null, "id", Integer.toString(window.getId()));
                xml.attribute(null, "layer", Integer.toString(window.getLayer()));
                xml.attribute(null, "topmost", Boolean.toString(index == 0));
                xml.attribute(null, "active", Boolean.toString(window.isActive()));
                xml.attribute(null, "focused", Boolean.toString(window.isFocused()));
                xml.attribute(null, "accessibility-focused", Boolean.toString(window.isAccessibilityFocused()));
                ArrayDeque<AccessibilityNodeInfo> pending = new ArrayDeque<>();
                pending.add(roots.get(index));
                while (!pending.isEmpty()) {
                    if (++count > 2000) throw new IllegalStateException("hierarchy_limit");
                    AccessibilityNodeInfo node = pending.removeFirst();
                    Rect bounds = new Rect();
                    node.getBoundsInScreen(bounds);
                    xml.startTag(null, "node");
                    xml.attribute(null, "window-id", Integer.toString(window.getId()));
                    xml.attribute(null, "topmost-window", Boolean.toString(index == 0));
                    xml.attribute(null, "package", text(node.getPackageName()));
                    xml.attribute(null, "class", text(node.getClassName()));
                    xml.attribute(null, "text", node.isPassword() ? "" : text(node.getText()));
                    xml.attribute(null, "content-desc", text(node.getContentDescription()));
                    xml.attribute(null, "bounds", "["+bounds.left+","+bounds.top+"]["+bounds.right+","+bounds.bottom+"]");
                    xml.attribute(null, "focused", Boolean.toString(node.isFocused()));
                    xml.attribute(null, "password", Boolean.toString(node.isPassword()));
                    xml.attribute(null, "visible-to-user", Boolean.toString(node.isVisibleToUser()));
                    xml.attribute(null, "checked", Boolean.toString(node.isChecked()));
                    xml.attribute(null, "checkable", Boolean.toString(node.isCheckable()));
                    xml.attribute(null, "clickable", Boolean.toString(node.isClickable()));
                    xml.attribute(null, "enabled", Boolean.toString(node.isEnabled()));
                    xml.attribute(null, "editable", Boolean.toString(node.isEditable()));
                    xml.attribute(null, "scrollable", Boolean.toString(node.isScrollable()));
                    xml.attribute(null, "accessibility-focused", Boolean.toString(node.isAccessibilityFocused()));
                    xml.endTag(null, "node");
                    for (int i=0;i<node.getChildCount();i++) {
                        AccessibilityNodeInfo child = node.getChild(i);
                        if (child != null) pending.addLast(child);
                    }
                }
                xml.endTag(null, "window");
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
