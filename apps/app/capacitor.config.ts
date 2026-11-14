import type { CapacitorConfig } from "@capacitor/cli";

// Grace's Android identity, which scripts/android.ts gives the generated host at `android.path`; `cap copy` puts the web build there.
const config: CapacitorConfig = {
  appId: "technology.graceful.grace",
  appName: "Grace",
  webDir: "dist",
  loggingBehavior: "none",
  android: { path: "android/generated" },
  // MainActivity insets the content itself, for the bars and a cutout but not the keyboard, which overlays it.
  plugins: { SystemBars: { style: "LIGHT", insetsHandling: "disable" } },
};
export default config;
