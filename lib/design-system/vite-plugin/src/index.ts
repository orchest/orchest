import type { Plugin } from "vite";
import { getCssString } from "@orchest/design-system";

export const vitePluginDesignSystem = (): Plugin => {
  return {
    name: "vite-plugin-design-system",
    transformIndexHtml(html) {
      return html.replace(
        /<\/head>/,
        `    <style id="stitches">${getCssString()}</style>
    </head>`
      );
    },
  };
};
