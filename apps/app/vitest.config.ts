import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";
import { project } from "vibestack/testing/vitest";

const base = project({ root: import.meta.dirname, plugins: [tailwindcss()] });

export default defineConfig(async (env) => {
  const config = await base(env);
  return { ...config, test: { ...config.test, globalSetup: ["test/setup.vibe"] } };
});
