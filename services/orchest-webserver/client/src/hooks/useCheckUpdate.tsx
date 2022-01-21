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

export const useCheckUpdate = () => {
  let [skipVersion, setSkipVersion] = useLocalStorage("skip_version", null);

  // Only make requests every hour, because the latest Orchest version gets
  // fetched once per hour. Use `useSWRImmutable` to disable all kinds of
  // automatic revalidation; just serve from cache and refresh cache
  // once per hour.
  const { data: updateInfo, mutate: mutateInfo } = useSWRImmutable<UpdateInfo>(
    "/async/orchest-update-info",
    fetcher,
    { refreshInterval: 3600000 }
  );
  const { data: orchestVersion, mutate: mutateVersion } = useSWRImmutable<
    OrchestVersion
  >("/async/version", fetcher, { refreshInterval: 3600000 });

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

  const checkUpdateNow = async () => {
    const [newInfo, newVersion] = await Promise.all([
      mutateInfo(),
      mutateVersion(),
    ]);
    if (newInfo && newVersion) {
      const shouldPrompt = shouldPromptOrchestUpdate(
        newVersion.version,
        newInfo.latest_version
      );
      if (shouldPrompt) {
        // TODO: Isn't it strange that promptUpdate actually doesn't use
        // the newVersion and newInfo but the mutated orchestVersion and
        // updateInfo. Does it actually work correctly? Otherwise I can just
        // pass the values to the function.
        promptUpdate();
      } else {
        setConfirm(
          "No update available",
          "There doesn't seem to be a new update available."
        );
      }
    }
  };

  const promptUpdate = () => {
    setConfirm(
      "Update available",
      <Typography variant="body2">
        Orchest can be updated from <Code>{orchestVersion.version}</Code> to{" "}
        <Code>{updateInfo.latest_version}</Code>. Would you like to update now?
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

  // TODO: Couldn't this actually trigger multiple setConfirm dialogs?
  // Because the updateInfo value could get updated due to a call to
  // checkUpdateNow. It would then get prompted by the functioncall and
  // by this effect, right?
  React.useEffect(() => {
    if (updateInfo && orchestVersion) {
      const shouldPrompt = shouldPromptOrchestUpdate(
        orchestVersion.version,
        updateInfo.latest_version,
        skipVersion
      );
      if (shouldPrompt) {
        promptUpdate();
      }
    }
  }, [updateInfo, orchestVersion]);

  return checkUpdateNow;
};
