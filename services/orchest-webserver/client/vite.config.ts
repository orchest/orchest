import { defineConfig } from "vite";
import path from "path";
import reactRefresh from "@vitejs/plugin-react-refresh";
import { vitePluginDesignSystem } from "@orchest/design-system-vite-plugin";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [reactRefresh(), vitePluginDesignSystem()],
  server: {
    host: "0.0.0.0",
    hmr: false,
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
  build: {
    chunkSizeWarningLimit: 2000,
  },
});
