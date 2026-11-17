// spec/app/conversation.md, "Story: Talk or type without losing the conversation"
import { Capacitor, type PluginListenerHandle, registerPlugin } from "@capacitor/core";

type Post = { method: "POST"; path: string; body?: Record<string, unknown> };

interface EmbeddedAgent {
  getStatus(): Promise<unknown>;
  request(input: Post): Promise<unknown>;
  requestStream(input: Post & { id: string }): Promise<{ id: string }>;
  abort(input: { id: string }): Promise<{ aborted: boolean }>;
  addListener(event: "status" | "streamData" | "streamEnd", listener: (input: unknown) => void): Promise<PluginListenerHandle>;
}

export const agentPlugin = Capacitor.isPluginAvailable("EmbeddedAgent") ? registerPlugin<EmbeddedAgent>("EmbeddedAgent") : undefined;
export type { EmbeddedAgent };
