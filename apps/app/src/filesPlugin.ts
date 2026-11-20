// spec/app/files.md, "Story: Find and open something I saved"
import { Capacitor, registerPlugin } from "@capacitor/core";

import type { SavedFile } from "../gen/app__files.ts";

export interface FileAttachment {
  file: SavedFile;
  data: string;
  version: string;
  from?: string;
  subject?: string;
}

export interface FilesPort {
  open(): Promise<unknown>;
  close(input: { lease: string }): Promise<void>;
  list(input: { lease: string }): Promise<unknown>;
  preview(input: { lease: string; id: string; page: number; small?: boolean }): Promise<unknown>;
  pick?(input: { lease: string; kind: "photo" | "pdf" }): Promise<unknown>;
  capture?(input: { lease: string }): Promise<unknown>;
  saveAttachments(input: { lease: string; attachments: readonly FileAttachment[] }): Promise<unknown>;
  remove(input: { lease: string; id: string }): Promise<void>;
  commit?(input: { lease: string; id: string }): Promise<unknown>;
}

export const filesPlugin = Capacitor.isPluginAvailable("GraceFiles") ? registerPlugin<FilesPort>("GraceFiles") : undefined;
