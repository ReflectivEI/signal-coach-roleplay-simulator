import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import os from "node:os";

const workerPaths = [
  "/api/llm/invoke",
  "/health",
  "/api/scenarios",
  "/api/roleplay/sessions",
  "/api/roleplay/start",
  "/api/roleplay/respond",
  "/api/rps/generate-scenario",
  "/api/rps/evaluate-response",
  "/api/rps/predictive-hcp-response",
  "/api/rps/save-session",
  "/api/predict-next-event",
  "/api/voice-telemetry",
  "/api/recommendation-reasoning",
];

const localWorkerUrl = "http://127.0.0.1:8787";

function getLocalNetworkUrl(port) {
  const interfaces = os.networkInterfaces();
  for (const addresses of Object.values(interfaces)) {
    for (const address of addresses || []) {
      if (address && address.family === "IPv4" && !address.internal) {
        return `http://${address.address}:${port}`;
      }
    }
  }
  return null;
}

export default defineConfig({
  logLevel: "error",
  plugins: [
    react(),
    {
      name: "local-network-access-logger",
      configureServer(server) {
        server.httpServer?.once("listening", () => {
          const localUrl = getLocalNetworkUrl(5173);
          if (localUrl) {
            console.log(`Local network access: ${localUrl}`);
          }
        });
      },
    },
  ],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    outDir: "dist/client",
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true,
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
  }
});
