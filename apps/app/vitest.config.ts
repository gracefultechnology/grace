import tailwindcss from "@tailwindcss/vite";
import { defaultClientConditions } from "vite";
import { defineConfig } from "vitest/config";
import { project } from "vibestack/testing/vitest";

const base = project({ root: import.meta.dirname, plugins: [tailwindcss()] });

export default defineConfig(async (env) => {
  const config = await base(env);
  return { ...config, resolve: { ...config.resolve, conditions: ["eliza-source", ...defaultClientConditions] }, test: { ...config.test, globalSetup: ["test/setup.vibe"] } };
});
