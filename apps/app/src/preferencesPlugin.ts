// spec/app/preferences.md, "Restart restores confirmed preferences and invalidates pending acknowledgements"
import { Capacitor, registerPlugin } from "@capacitor/core";

export interface PreferenceRecords {
  read(input: { name: "preferences" }): Promise<unknown>;
  write(input: { name: "preferences"; revision: number; value: string }): Promise<unknown>;
}

export const preferenceRecords = Capacitor.isPluginAvailable("GraceRecords")
  ? registerPlugin<PreferenceRecords>("GraceRecords") : undefined;

export interface PreferenceDevice {
  getDevice(): Promise<unknown>;
  setBrightness(input: { percent: number }): Promise<unknown>;
  setVolume(input: { step: number; muted: boolean }): Promise<unknown>;
}

export const preferenceDevice = Capacitor.isPluginAvailable("GraceDevice")
  ? registerPlugin<PreferenceDevice>("GraceDevice") : undefined;
