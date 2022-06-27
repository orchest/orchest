import React from "react";
import { useLocationQuery } from "./useCustomRoute";

export const useImportUrl = (initialValue = "") => {
  const [url, setRawUrl] = React.useState<string>(initialValue);

  const setUrl = React.useCallback(
    (url: string) => setRawUrl(url.trim().toLowerCase()),
    []
  );

  return [url, setUrl] as const;
};

export const useImportUrlFromQueryString = (initialImportUrl?: string) => {
  const [importUrlFromQuerystring] = useLocationQuery(["import_url"]);
  const hasPrefilledImportUrl =
    initialImportUrl ||
    (importUrlFromQuerystring && typeof importUrlFromQuerystring === "string");

  const [importUrl, setImportUrl] = useImportUrl(
    hasPrefilledImportUrl
      ? initialImportUrl ||
          window.decodeURIComponent(importUrlFromQuerystring as string)
      : ""
  );

  return [importUrl, setImportUrl] as const;
};
