import path from "path";
import { defineConfig } from "vite";
import reactRefresh from "@vitejs/plugin-react-refresh";
import { getCssString } from "@orchest/design-system";

const stitchesPlugin = () => {
  return {
    name: "html-transform",
    transformIndexHtml(html) {
      return html.replace(
        /<title>(.*?)<\/title>/,
        `<title>Title replaced!</title>`
      );
    },
  };
};

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
