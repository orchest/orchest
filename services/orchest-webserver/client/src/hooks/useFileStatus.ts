import { useFileApi } from "@/api/files/useFileApi";
import { FileRoot } from "@/utils/file";
import { fileMapDepth } from "@/utils/file-map";
import { directoryLevel } from "@/utils/path";
import React from "react";

export type FileStatus = "unknown" | "not-found" | "found";

/**
 * Checks the local file state for a file,
 * if the file is in a directory which is not yet loaded,
 * `'unknown'` is returned, otherwise `'found'` or '`not-found`' is returned.
 */
export const useFileStatus = (
  root: FileRoot | undefined,
  path: string | undefined
): FileStatus => {
  const fileMap = useFileApi((api) => (root ? api.roots[root] : undefined));
  const rootDepth = React.useMemo(() => fileMapDepth(fileMap ?? {}), [fileMap]);

  if (!path || !fileMap) return "unknown";
  else if (directoryLevel(path) > rootDepth) return "unknown";
  else if (fileMap[path]) return "found";
  else return "not-found";
};
