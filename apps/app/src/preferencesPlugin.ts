// spec/app/preferences.md, "Restart restores confirmed preferences and invalidates pending acknowledgements"; spec/app/workspace.md, "An authenticated restart restores the reviewed plan paused at its next outcome"
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
}

export const preferenceDevice = Capacitor.isPluginAvailable("GraceDevice")
  ? registerPlugin<PreferenceDevice>("GraceDevice") : undefined;
