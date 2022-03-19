import {
  ALLOWED_STEP_EXTENSIONS,
  extensionFromFilename,
  fetcher,
  hasValue,
  HEADER,
} from "@orchest/lib-utils";
import useSWR from "swr";

export const pathValidator = (value: string) => {
  if (!hasValue(value)) return false;
  if (value === "" || value.endsWith("/")) {
    return false;
  }
  let ext = extensionFromFilename(value);
  if (ALLOWED_STEP_EXTENSIONS.indexOf(ext) === -1) {
    return false;
  }
  return true;
};

export const isValidFile = async (
  project_uuid: string,
  pipeline_uuid: string,
  path: string
) => {
  // only check file existence if it passes rule based validation
  if (!project_uuid || !pipeline_uuid || !pathValidator(path)) return false;
  const response = await fetcher(
    `/async/project-files/exists/${project_uuid}/${pipeline_uuid}`,
    {
      method: "POST",
      headers: HEADER.JSON,
      body: JSON.stringify({
        path
      }),
    }
  );
  return hasValue(response);
};

/**
 * checks if a file exists with the given path, poll per 1000 ms
 * @param project_uuid
 * @param pipeline_uuid
 * @param path
 * @returns boolean
 */
export const useCheckFileValidity = (
  project_uuid: string,
  pipeline_uuid: string,
  path: string
) => {
  // this is no the actual URL (path is part of the request body, not a path arg),
  // but we use this as a unique cache key for swr
  const cacheKey = `/async/project-files/exists/${project_uuid}/${pipeline_uuid}/${path}`;

  const { data = false } = useSWR(
    project_uuid && pipeline_uuid && path ? cacheKey : null,
    () => isValidFile(project_uuid, pipeline_uuid, path),
    { refreshInterval: 1000 }
  );

  return data;
};
