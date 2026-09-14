import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const workspaceRoot = fileURLToPath(new URL("../..", import.meta.url));
  const env = loadEnv(mode, workspaceRoot, "");
  const apiOrigin =
    env.VITE_KANON_API_ORIGIN || "https://kanon-api.onrender.com";
  const companyToken = env.KANON_COMPANY_API_TOKEN;

  return {
    envDir: workspaceRoot,
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      port: 5173,
      proxy: {
        "/api": {
          target: apiOrigin,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
          configure: (proxy) => {
            proxy.on("proxyReq", (request) => {
              if (companyToken) {
                request.setHeader("x-kanon-company-token", companyToken);
              }
            });
          },
        },
      },
    },
    build: {
      outDir: "dist",
      sourcemap: true,
    },
  };
});
