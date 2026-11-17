import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import vibelang from "vibelang-vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vibelang(), react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { "/api": { target: "http://localhost:8787", changeOrigin: true } },
  },
});
