import type { RegisteredCommand } from "../runner.ts";
import { benchmarkCommand } from "./benchmark.ts";
import { deployCommand } from "./deploy.ts";
import { statusCommand } from "./status.ts";
import { verifyLiveCommand } from "./verify-live.ts";
import { walkthroughCommand } from "./walkthrough.ts";

export const commands: readonly RegisteredCommand[] = [statusCommand, deployCommand, verifyLiveCommand, walkthroughCommand, benchmarkCommand];
