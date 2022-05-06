import React from "react";
import { useLocationQuery } from "./useCustomRoute";

export const useImportUrl = (initialImportUrl?: string) => {
  const [importUrlFromQuerystring] = useLocationQuery(["import_url"]);
  const hasPrefilledImportUrl =
    initialImportUrl ||
    (importUrlFromQuerystring && typeof importUrlFromQuerystring === "string");

  const [importUrl, setRawImportUrl] = React.useState<string>(
    hasPrefilledImportUrl
      ? initialImportUrl ||
          window.decodeURIComponent(importUrlFromQuerystring as string)
      : ""
  );

  const setImportUrl = React.useCallback(
    (url: string) => setRawImportUrl(url.trim().toLowerCase()),
    []
  );

  return [importUrl, setImportUrl] as const;
};
