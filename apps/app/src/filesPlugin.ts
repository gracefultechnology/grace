// spec/app/files.md, "Story: Find and open something I saved"
import { Capacitor, registerPlugin } from "@capacitor/core";

export interface FilesPort {
  open(): Promise<unknown>;
  close(input: { lease: string }): Promise<void>;
  list(input: { lease: string }): Promise<unknown>;
  preview(input: { lease: string; id: string; page: number; small?: boolean }): Promise<unknown>;
  pick(input: { lease: string; kind: "photo" | "pdf" }): Promise<unknown>;
  capture(input: { lease: string }): Promise<unknown>;
  commit(input: { lease: string; id: string }): Promise<unknown>;
}

export const filesPlugin = Capacitor.isPluginAvailable("GraceFiles") ? registerPlugin<FilesPort>("GraceFiles") : undefined;
