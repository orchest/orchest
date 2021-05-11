import path from "path";
import { defineConfig } from "vite";
import reactRefresh from "@vitejs/plugin-react-refresh";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [reactRefresh()],
  server: {
    host: "0.0.0.0",
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
    preprocessOptions: {
      scss: {
        includePaths: ["node_modules"],
      },
    },
  },
});
