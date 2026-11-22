package technology.graceful.grace;

import android.content.Context;
import android.util.AttributeSet;
import android.util.SparseArray;
import android.view.ViewStructure;
import android.view.autofill.AutofillValue;

import com.getcapacitor.CapacitorWebView;

public final class GraceChromeWebView extends CapacitorWebView {
 public GraceChromeWebView(Context context, AttributeSet attributes) {
  super(context, attributes);
 }

 @Override public void onProvideAutofillStructure(ViewStructure structure, int flags) {
  structure.setChildCount(0);
 }

 @Override public void onProvideAutofillVirtualStructure(ViewStructure structure, int flags) {
  structure.setChildCount(0);
 }

 @Override public void autofill(SparseArray<AutofillValue> values) {}
}
