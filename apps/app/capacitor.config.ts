import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "technology.graceful.grace",
  appName: "Grace",
  webDir: "dist",
  loggingBehavior: "none",
  android: { path: "android/generated" },
  plugins: { SystemBars: { style: "LIGHT", insetsHandling: "disable" } },
};
export default config;
