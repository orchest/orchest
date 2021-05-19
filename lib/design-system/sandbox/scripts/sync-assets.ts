import fs from "fs-extra";
import path from "path";

const ASSETS_DIR = path.join(
  process.cwd(),
  "node_modules/@orchest/design-system/dist/assets"
);
const PUBLIC_DIR = path.join(process.cwd(), "public");

try {
  fs.emptyDirSync(PUBLIC_DIR);
  fs.copy(
    ASSETS_DIR,
    path.join(PUBLIC_DIR, "design-system", "assets"),
    (err) => {
      if (err) throw err;
    }
  );
} catch (err) {
  throw err;
}
