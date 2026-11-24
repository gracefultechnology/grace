import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import vibelang from "vibelang-vite";
import { defaultClientConditions, defineConfig } from "vite";

function manualChunks(id: string): string | undefined {
  if (id.includes("/node_modules/react/") || id.includes("/node_modules/react-dom/") || id.includes("/node_modules/scheduler/")) {
    return "react";
  }
  if (id.includes("/node_modules/effect/")) {
    return "effect";
  }
  if (id.includes("/packages/ui/") || id.includes("/node_modules/@radix-ui/") || id.includes("/node_modules/lucide-react/")) {
    return "ui";
  }
  return undefined;
}

export default defineConfig({
  plugins: [vibelang(), react(), tailwindcss()],
  resolve: { conditions: ["eliza-source", ...defaultClientConditions] },
  build: {
    rollupOptions: {
      output: { manualChunks },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { "/api": { target: "http://localhost:8787", changeOrigin: true } },
  },
});
