import path from "path";
import { defineConfig } from "vite";
import reactRefresh from "@vitejs/plugin-react-refresh";
import { vitePluginDesignSystem } from "@orchest/design-system-vite-plugin";

// https://vitejs.dev/config/
export default (conditions) =>
  defineConfig({
    plugins: [reactRefresh(), vitePluginDesignSystem()],
    server: {
      host: "0.0.0.0",
      proxy: conditions.mode === "development" && {
        "^/(analytics|api|async|catch|container-file-manager|heartbeat|store|update-server)/*": {
          target: "http://localhost:8000",
          changeOrigin: true,
        },
        "^/login/*": {
          target: "http://localhost:3001/login/",
          changeOrigin: true,
          rewrite: (path) => {
            console.log(path.replace("/login", ""));
            return path.replace("/login", "");
          },
        },
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
  });
