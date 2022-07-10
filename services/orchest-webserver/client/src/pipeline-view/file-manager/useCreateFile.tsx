import { useCustomRoute } from "@/hooks/useCustomRoute";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import { FILE_MANAGEMENT_ENDPOINT, queryArgs, ROOT_SEPARATOR } from "./common";

/**
 * Returns a function which creates a file relative to the provided root.
 * The returned path will be an absolute project path, starting with `project-dir:/` or `data:/`.
 *
 * The hook throws if there is no `projectUuid` in the route.
 */
export const useCreateFile = (root: string) => {
  const { projectUuid } = useCustomRoute();

  const createFile = React.useMemo(
    () => async (path: string) => {
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
