import { Code } from "@/components/common/Code";
import { useAppContext } from "@/contexts/AppContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { siteMap } from "@/Routes";
import { OrchestVersion, UpdateInfo } from "@/types";
import Typography from "@mui/material/Typography";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import useSWRImmutable from "swr/immutable";

// To limit the number of api calls it is best to place this hook in
// top-level components (i.e. the ones defined in the routingConfig.tsx).
export const useCheckUpdate = () => {
  const [skipVersion, setSkipVersion] = useLocalStorage("skip_version", null);

  // Only make requests every hour, because the latest Orchest version gets
  // fetched once per hour. Use `useSWRImmutable` to disable all kinds of
  // automatic revalidation; just serve from cache and refresh cache
  // once per hour.
  const { data: orchestVersion } = useSWRImmutable<OrchestVersion>(
    "/async/version",
    fetcher,
    { refreshInterval: 3600000 }
  );
  const { data: updateInfo } = useSWRImmutable<UpdateInfo>(
    "/async/orchest-update-info",
    fetcher,
    { refreshInterval: 3600000 }
  );

  const { setConfirm } = useAppContext();
  const { navigateTo } = useCustomRoute();

  const updateView = () => {
    navigateTo(siteMap.update.path);
  };

  const shouldPromptOrchestUpdate = (
    currentVersion: string,
    latestVersion: string | null,
    skipVersion: string | null = null
  ) => {
    // The latest version information has not yet been fetched by Orchest.
    if (latestVersion === null) {
      return false;
    }

    if (latestVersion > currentVersion) {
      if (skipVersion === latestVersion) {
        return false;
      } else {
        return true;
      }
    } else {
      return false;
    }
  };

  const promptUpdate = (currentVersion: string, latestVersion: string) => {
    setConfirm(
      "Update available",
      <Typography variant="body2">
        Orchest can be updated from <Code>{currentVersion}</Code> to{" "}
        <Code>{latestVersion}</Code>. Would you like to update now?
      </Typography>,
      {
        onConfirm: async (resolve) => {
          updateView();
          resolve(true);
          return true;
        },
        onCancel: async (resolve) => {
          setSkipVersion(updateInfo.latest_version);
          resolve(false);
          return false;
        },
        confirmLabel: "Update",
        cancelLabel: "Skip this version",
      }
    );
  };

  const handlePrompt = (
    orchestVersion: OrchestVersion,
    updateInfo: UpdateInfo,
    skipVersion: string | null,
    noOp: boolean
  ) => {
    const currentVersion = orchestVersion.version;
    const latestVersion = updateInfo.latest_version;

    const shouldPrompt = shouldPromptOrchestUpdate(
      currentVersion,
      latestVersion,
      skipVersion
    );
    if (shouldPrompt) {
      promptUpdate(currentVersion, latestVersion);
    } else {
      if (!noOp) {
        setConfirm(
          "No update available",
          "There doesn't seem to be a new update available."
        );
      }
    }
  };
  const checkUpdateNow = async () => {
    // Use fetcher directly instead of mutate function from the SWR
    // calls to prevent updating the values which would trigger the
    // useEffect and thereby prompting the user twice. In addition,
    // we want to be able to tell the user that no update is available
    // if this function is invoked.
    const [orchestVersion, updateInfo]: [
      OrchestVersion,
      UpdateInfo
    ] = await Promise.all([
      fetcher("/async/version"),
      fetcher("/async/orchest-update-info"),
    ]);
    if (orchestVersion && updateInfo) {
      handlePrompt(orchestVersion, updateInfo, null, false);
    }
  };

  React.useEffect(() => {
    if (orchestVersion && updateInfo) {
      handlePrompt(orchestVersion, updateInfo, skipVersion, true);
    }
  }, [orchestVersion, updateInfo, skipVersion]);

  return checkUpdateNow;
};
