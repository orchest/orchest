import path from "path";
import glob from "glob";
import fs from "fs-extra";
import sizeOf from "image-size";

const ASSETS_DIR = path.join(
  process.cwd(),
  "node_modules/@orchest/design-system/src/assets"
);
const PUBLIC_DIR = path.join(process.cwd(), "public");

export interface IAsset
  extends Record<"src" | "title", string>,
    Record<"height" | "width", number> {}

export interface IGetAssetsReturn
  extends Record<"badges" | "favicons" | "og", IAsset[]> {}

export const getAssets = (): IGetAssetsReturn => {
  const assets = glob
    .sync("public/design-system/assets/**/*.*")
    .map((asset) => {
      const src = asset.replace("public", "");
      const { height, width } = sizeOf(asset);

      return { src, title: src.replace("/design-system", ""), height, width };
    })
    .sort((a, b) => a.width - b.width);

  return {
    badges: assets.filter(({ src }) => src.includes("badges")),
    favicons: assets.filter(({ src }) => src.includes("icon")),
    og: assets.filter(({ src }) => src.includes("og-")),
  };
};

export const copyAssetsToPublic = () => {
  fs.emptyDirSync(PUBLIC_DIR);
  fs.copy(
    ASSETS_DIR,
    path.join(PUBLIC_DIR, "design-system", "assets"),
    (err) => {
      if (err) throw err;
    }
  );
};
