import { fn } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { tapCalls } from "./Button.meta.tsx";
import { overWifiPage } from "./SettingsApp.meta.tsx";
import type { WifiSignInSheetProps } from "./WifiSignInSheet.tsx";

/* eslint-disable design-system/no-literal-colors -- the library's own web page, as the network serves it (prototype `.psweb`), not the tablet's */
const library = { green: "#1F5C3F", page: "#F3F5F2", ink: "#1B2B22", text: "#44524A", rule: "#D5DBD4", field: "#9AA59D", white: "#FFFFFF" };
/* eslint-enable design-system/no-literal-colors */
const serif = "Georgia, 'Times New Roman', serif";
const sans = "Arial, sans-serif";
const field = { width: "100%", boxSizing: "border-box", height: 46, padding: "0 12px", border: `1px solid ${library.field}`, borderRadius: 4, background: library.white, font: `18px ${sans}` } as const;
const label = { display: "block", margin: "12px 0 6px", font: `700 15px ${sans}` } as const;

// Prototype `portalSheet()`: the Riverside Public Library's sign-in page.
const page = (
  <div style={{ minHeight: "100%", background: library.page, fontFamily: serif, lineHeight: "normal", color: library.ink }}>
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 32px", background: library.green, color: library.white, fontSize: 22 }}>
      <span style={{ width: 44, height: 44, borderRadius: 6, background: library.white, color: library.green, display: "flex", alignItems: "center", justifyContent: "center", font: `700 26px ${serif}` }}>R</span>
      <b>Riverside Public Library</b>
    </div>
    <div style={{ boxSizing: "content-box", maxWidth: 520, margin: "28px auto", padding: "28px 32px", background: library.white, border: `1px solid ${library.rule}` }}>
      <h2 style={{ margin: "0 0 8px", fontSize: 30, fontWeight: 700 }}>Free Wi-Fi</h2>
      <p style={{ margin: "0 0 18px", font: `16px/1.5 ${sans}`, color: library.text }}>Sign in with your library card to use the internet. Sessions last 4 hours.</p>
      <label style={label}>
        Library card number
        <input style={{ ...field, marginTop: 6 }} autoComplete="off" />
      </label>
      <label style={label}>
        PIN
        <input type="password" style={{ ...field, marginTop: 6 }} autoComplete="off" />
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 0 6px", font: `15px ${sans}` }}>
        <input type="checkbox" defaultChecked style={{ margin: "3px 3px 3px 4px" }} /> I agree to the library’s internet use policy
      </label>
      <button type="button" disabled style={{ marginTop: 18, width: "100%", height: 50, border: 0, borderRadius: 4, background: library.green, color: library.white, font: `700 18px ${serif}`, opacity: 0.5 }}>
        Connect
      </button>
    </div>
  </div>
);

const cancel = fn();

export const meta: ComponentMeta<WifiSignInSheetProps> = {
  args: { network: "Riverside Library Guest", onCancel: cancel, children: page },
  decorator: overWifiPage,
  play: {
    Default: tapCalls("Cancel", cancel),
  },
};
