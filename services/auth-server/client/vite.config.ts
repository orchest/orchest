import path from "path";
import { defineConfig } from "vite";
import reactRefresh from "@vitejs/plugin-react-refresh";

// https://vitejs.dev/config/
export default (conditions) =>
  defineConfig({
    plugins: [reactRefresh()],
    base: "/login/",
    server: {
      host: "0.0.0.0",
      port: 3001,
      proxy: conditions.mode === "development" && {
        "^/login/(server-config|submit|users)/*": "http://localhost:8000",
      },
    },
    define: {
      global: "window",
    },
    resolve: {
      alias: {
        "@material": path.resolve(
          __dirname,
          "../../../node_modules/@material/"
        ),
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          includePaths: ["node_modules"],
        },
      },
    },
  });
