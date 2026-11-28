export type LlmProvider = "cerebras" | "openai" | "ollama";

export type LlmConfig = {
  readonly provider: LlmProvider;
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly model: string;
  readonly maxTokens: number;
  readonly disableReasoning: boolean;
  readonly reasoningEffort?: "low" | "medium" | "high";
};

function parseLlmProvider(raw: string | undefined): LlmProvider {
  if (raw === "cerebras" || raw === "openai" || raw === "ollama") return raw;
  if (raw === undefined || raw === "") {
    if (process.env.CEREBRAS_API_KEY) return "cerebras";
    if (process.env.OPENAI_API_KEY) return "openai";
    return "ollama";
  }
  throw new Error(`Unsupported LLM provider "${raw}". Expected cerebras, openai, or ollama.`);
}

export function resolveLlmConfig(options: {
  readonly provider?: string;
  readonly model?: string;
  readonly baseUrl?: string;
  readonly maxTokens?: number;
}): LlmConfig {
  const provider = parseLlmProvider(options.provider);
  if (provider === "cerebras") {
    const model = options.model ?? process.env.GRACE_LLM_MODEL ?? "qwen-3.8-27b";
    const isGptOss = /gpt-oss/iu.test(model);
    return {
      provider,
      baseUrl: (options.baseUrl ?? process.env.CEREBRAS_BASE_URL ?? "https://api.cerebras.ai/v1").replace(/\/+$/u, ""),
      apiKey: process.env.CEREBRAS_API_KEY ?? "",
      model,
      maxTokens: options.maxTokens ?? 2048,
      disableReasoning: !isGptOss,
      ...(isGptOss ? { reasoningEffort: "low" as const } : {}),
    };
  }
  if (provider === "openai") {
    const model = options.model ?? process.env.GRACE_LLM_MODEL ?? "gpt-4o-mini";
    return {
      provider,
      baseUrl: (options.baseUrl ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/u, ""),
      apiKey: process.env.OPENAI_API_KEY ?? "",
      model,
      maxTokens: options.maxTokens ?? 2048,
      disableReasoning: false,
    };
  }
  return {
    provider,
    baseUrl: (options.baseUrl ?? process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434/v1").replace(/\/+$/u, ""),
    apiKey: process.env.OLLAMA_API_KEY ?? "ollama",
    model: options.model ?? process.env.GRACE_LLM_MODEL ?? "qwen2.5:14b",
    maxTokens: options.maxTokens ?? 2048,
    disableReasoning: false,
  };
}
