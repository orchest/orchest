import {
  ALLOWED_STEP_EXTENSIONS,
  extensionFromFilename,
  fetcher,
  hasValue,
  HEADER,
} from "@orchest/lib-utils";
import React from "react";
import { useAsync } from "./useAsync";

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
  if (!pathValidator(path)) return false;
  const response = await fetcher(
    `/async/project-files/exists/${project_uuid}/${pipeline_uuid}`,
    {
      method: "POST",
      headers: HEADER.JSON,
      body: JSON.stringify({
        relative_path: path,
      }),
    }
  );
  return hasValue(response);
};

export const useCheckFileValidity = (
  project_uuid: string,
  pipeline_uuid: string,
  path: string
) => {
  const { run, data = false } = useAsync<boolean>();
  React.useEffect(() => {
    run(isValidFile(project_uuid, pipeline_uuid, path));
  }, [path, pipeline_uuid, project_uuid, run]);
  return data;
};
