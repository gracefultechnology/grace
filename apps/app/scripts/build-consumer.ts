import type { buildAndroidConsumer as upstream } from "../../../vendor/eliza/packages/os/android/build-consumer.mjs";

type Inferred = typeof upstream extends (options: infer Options) => unknown ? Options : never;
type Command = { readonly command: string; readonly args: readonly string[] };
type Retyped = {
  readonly variants: readonly string[];
  readonly verify: Command;
  readonly prepare?: readonly (Command | { readonly gradleTasks: readonly string[] })[];
  readonly signing?: { readonly environment: readonly string[] } | null;
  readonly archive?: Inferred["archive"];
};

export declare function buildAndroidConsumer(options: Omit<Inferred, keyof Retyped> & Pick<Retyped, keyof Retyped & keyof Inferred>): ReturnType<typeof upstream>;
