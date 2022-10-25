import { useFileApi } from "@/api/files/useFileApi";
import React from "react";
import { ROOT_SEPARATOR } from "./common";

/**
 * Creates a file and returns the absolute path of it.
 *
 * If a `projectUuid` is not found in the current route,
 * this function will throw an error.
 */
type FileCreator = (path: string) => Promise<string>;

/**
 * Returns a function which creates a file relative to the provided root.
 * The returned path will be an absolute project path, starting with `project-dir:/` or `data:/`.
 */
export const useCreateFile = (root: string): FileCreator => {
  const create = useFileApi((api) => api.create);

  const createFile = React.useCallback(
    async (path: string) => {
      await create(root, path);

      return `${root}${ROOT_SEPARATOR}${path}`;
    },
    [create, root]
  );

  return createFile;
};
