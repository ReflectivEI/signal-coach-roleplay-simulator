import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { fileURLToPath, URL } from "node:url";

const workerPaths = ["/api/llm/invoke", "/health"];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const workerUrl = (env.VITE_ROLEPLAY_WORKER_URL || "").replace(/\/+$/, "");

  return {
    logLevel: "error",
    plugins: [react()],
    resolve: {
      dedupe: ["react", "react-dom"],
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: workerUrl
      ? {
          proxy: Object.fromEntries(
            workerPaths.map((path) => [
              path,
              {
                target: workerUrl,
                changeOrigin: true,
                secure: true,
              },
            ]),
          ),
        }
      : undefined,
  };
});
