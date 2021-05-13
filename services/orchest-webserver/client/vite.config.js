import path from "path";
import { defineConfig } from "vite";
import ViteStitches from "vite-plugin-stitches";
import reactRefresh from "@vitejs/plugin-react-refresh";
import { getCssString } from "@orchest/design-system";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [reactRefresh(), ViteStitches({ getCssString })],
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
