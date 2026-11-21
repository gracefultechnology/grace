import type { CapacitorConfig } from "@capacitor/cli";

export const androidPaths = { project: "android/generated", web: "dist" };

const config: CapacitorConfig = {
  appId: "technology.graceful.grace",
  appName: "Grace",
  webDir: process.env.GRACE_ANDROID_CAPACITOR_WEB_DIR ?? androidPaths.web,
  loggingBehavior: "none",
  android: { path: process.env.GRACE_ANDROID_CAPACITOR_PROJECT ?? androidPaths.project },
  plugins: { SystemBars: { style: "LIGHT", insetsHandling: "disable" } },
};
export default config;
