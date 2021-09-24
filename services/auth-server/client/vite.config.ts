import { defineConfig } from "vite";
import path from "path";
import reactRefresh from "@vitejs/plugin-react-refresh";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [reactRefresh()],
  base: "/login/",
  server: {
    host: "0.0.0.0",
    port: 3001,
    hmr: false,
  },
  define: {
    global: "window",
  },
  resolve: {
    alias: {
      "@material": path.resolve(__dirname, "../../../node_modules/@material/"),
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
