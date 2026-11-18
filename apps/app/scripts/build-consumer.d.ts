type Command = { readonly command: string; readonly args: readonly string[] };

export declare function buildAndroidConsumer(options: {
  readonly root?: string;
  readonly environment?: NodeJS.ProcessEnv;
  readonly variants: readonly string[];
  readonly release?: boolean;
  readonly lint?: boolean;
  readonly androidTest?: boolean;
  readonly daemon?: boolean;
  readonly project?: string;
  readonly output?: string;
  readonly signing?: { readonly environment: readonly string[] } | null;
  readonly prepare?: readonly Command[];
  readonly verify: Command;
}): void;
