import fs from "fs-extra";
import path from "path";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const DIST_DIR = path.join(process.cwd(), "dist");

try {
  fs.emptyDirSync(DIST_DIR);

  fs.copy(PUBLIC_DIR, DIST_DIR, (err) => {
    if (err) throw err;
  });
} catch (err) {
  throw err;
}
