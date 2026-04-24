import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

const workerPaths = [
  "/api/llm/invoke",
  "/health",
  "/api/scenarios",
  "/api/roleplay/sessions",
  "/api/roleplay/start",
  "/api/roleplay/respond",
];

const localWorkerUrl = "http://127.0.0.1:8787";

export default defineConfig({
  logLevel: "error",
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: Object.fromEntries(
      workerPaths.map((path) => [
        path,
        {
          target: localWorkerUrl,
          changeOrigin: true,
          secure: false,
        },
      ]),
    ),
  },
});
