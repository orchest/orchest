import path from "path";
import { defineConfig } from "vite";
import reactRefresh from "@vitejs/plugin-react-refresh";
import { vitePluginDesignSystem } from "@orchest/design-system-vite-plugin";

export default defineConfig((env) => ({
  plugins: [reactRefresh(), vitePluginDesignSystem()],
  server: {
    host: "0.0.0.0",
    proxy: env.mode === "development" && {
      "^/(analytics|api|async|catch|container-file-manager|heartbeat|store|update-server)/*":
        "http://localhost:8000",
      "^/login/*": "http://localhost:3001",
    },
  },
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "src") },
      {
        find: "@material",
        replacement: path.resolve(
          __dirname,
          "../../../node_modules/@material/"
        ),
      },
    ],
  },
  css: {
    preprocessorOptions: {
      scss: {
        includePaths: ["node_modules"],
      },
    },
  },
}));
