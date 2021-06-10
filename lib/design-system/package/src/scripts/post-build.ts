import fs from "fs-extra";
import path from "path";

const ASSETS_DIR = path.join(process.cwd(), "src", "assets");
const DIST_DIR = path.join(process.cwd(), "dist", "assets");

try {
  fs.emptyDirSync(DIST_DIR);

  fs.copy(ASSETS_DIR, DIST_DIR, (err) => {
    if (err) throw err;
  });
} catch (err) {
  throw err;
}
