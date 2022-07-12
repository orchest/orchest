import { useCustomRoute } from "@/hooks/useCustomRoute";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import { FILE_MANAGEMENT_ENDPOINT, queryArgs, ROOT_SEPARATOR } from "./common";

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
  const { projectUuid } = useCustomRoute();

  const createFile = React.useCallback(
    async (path: string) => {
      if (!projectUuid) {
        throw new Error("A project UUID was not found in the route.");
      }

      const query = queryArgs({ projectUuid, root: root, path });

      await fetcher(`${FILE_MANAGEMENT_ENDPOINT}/create?${query}`, {
        method: "POST",
      });

      return `${root}${ROOT_SEPARATOR}${path}`;
    },
    [projectUuid, root]
  );

  return createFile;
};
