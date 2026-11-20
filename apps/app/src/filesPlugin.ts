// spec/app/files.md, "Story: Find and open something I saved"
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

import type { SavedFile } from "../gen/app__files.ts";

export interface FileAttachment {
  file: SavedFile;
  data: string;
  version: string;
}

export interface FilesPort {
  open(input?: { owner: string }): Promise<unknown>;
  close(input: { lease: string }): Promise<void>;
  list(input: { lease: string }): Promise<unknown>;
  preview(input: { lease: string; id: string; page: number; small?: boolean }): Promise<unknown>;
  pick?(input: { lease: string; kind: "photo" | "pdf" }): Promise<unknown>;
  capture?(input: { lease: string }): Promise<unknown>;
  saveAttachments(input: { lease: string; attachments: readonly FileAttachment[] }): Promise<unknown>;
  remove(input: { lease: string; id: string }): Promise<void>;
  commit?(input: { lease: string; id: string }): Promise<unknown>;
  addListener?(event: "attachmentImportChanged", listener: () => void): Promise<PluginListenerHandle>;
  attachmentImport?(): Promise<unknown>;
  cancelAttachmentImport?(input: { request: string }): Promise<void>;
  stageAttachmentImport?(input: { lease: string; request: string }): Promise<unknown>;
}

export const filesPlugin = Capacitor.isPluginAvailable("GraceFiles") ? registerPlugin<FilesPort>("GraceFiles") : undefined;
