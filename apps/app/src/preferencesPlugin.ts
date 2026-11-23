// spec/app/preferences.md, "Restart restores confirmed preferences and invalidates pending acknowledgements"; spec/app/workspace.md, "An authenticated restart restores the reviewed plan paused at its next outcome"; spec/app/network.md, "Android handles Wi-Fi sign-in"
import { Capacitor, registerPlugin } from "@capacitor/core";

export interface PreferenceRecords {
  read(input: { name: "preferences" }): Promise<unknown>;
  write(input: { name: "preferences"; revision: number; value: string }): Promise<unknown>;
}

const records = Capacitor.isPluginAvailable("GraceRecords")
  ? registerPlugin<PreferenceRecords & GuidedTaskRecords>("GraceRecords") : undefined;

export const preferenceRecords: PreferenceRecords | undefined = records;

export type GuidedRecordName = `guided-task-${string}`;

export interface GuidedTaskRecords {
  read(input: { name: GuidedRecordName }): Promise<unknown>;
  write(input: { name: GuidedRecordName; revision: number; value: string }): Promise<unknown>;
}

export const guidedTaskRecords: GuidedTaskRecords | undefined = records;

export interface PreferenceDevice {
  getDevice(): Promise<unknown>;
  setBrightness(input: { percent: number }): Promise<unknown>;
  setVolume(input: { step: number; muted: boolean }): Promise<unknown>;
  addListener?(event: "volume", listener: () => void): Promise<{ remove(): Promise<void> }>;
}

export interface WifiSignIn {
  getWifiSignIn(): Promise<unknown>;
  openWifiSignIn(): Promise<void>;
}

const device = Capacitor.isPluginAvailable("GraceDevice")
  ? registerPlugin<PreferenceDevice & WifiSignIn>("GraceDevice") : undefined;

export const preferenceDevice: PreferenceDevice | undefined = device;
export const wifiSignIn: WifiSignIn | undefined = device;
