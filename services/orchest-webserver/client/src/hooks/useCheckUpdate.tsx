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

const isVersionLTE = (oldVersion: string, newVersion: string) => {
  const [oldYear, oldMonth, oldPatch] = oldVersion.split(".");
  const [newYear, newMonth, newPatch] = newVersion.split(".");

  if (oldYear > newYear) return false;
  if (oldYear < newYear) return true;
  if (oldMonth > newMonth) return false;
  if (oldMonth < newMonth) return true;
  if (parseInt(oldPatch) > parseInt(newPatch)) return false;
  if (parseInt(oldPatch) < parseInt(newPatch)) return true;
  return true;
};

const shouldPromptOrchestUpdate = (
  currentVersion: string,
  latestVersion: string | null,
  skipVersion: string | null = null
) => {
  // The latest version information has not yet been fetched by Orchest.
  if (latestVersion === null) return false;
  if (isVersionLTE(latestVersion, currentVersion)) return false;
  return skipVersion !== latestVersion;
};

// To limit the number of api calls and make sure only one prompt is shown,
// it is best to place this hook in top-level components (i.e. the ones
// defined in the routingConfig.tsx).
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

  const promptUpdate = React.useCallback(
    (currentVersion: string, latestVersion: string) => {
      setConfirm(
        "Update available",
        <>
          <Typography variant="body2">
            Orchest can be updated from <Code>{currentVersion}</Code> to{" "}
            <Code>{latestVersion}</Code> . Would you like to update now?
          </Typography>
          <Typography variant="body2" sx={{ marginTop: 4 }}>
            Check out the{" "}
            <a href="https://github.com/orchest/orchest/releases/latest">
              release notes
            </a>
            .
          </Typography>
        </>,
        {
          onConfirm: async (resolve) => {
            navigateTo(siteMap.update.path);
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
    },
    [setConfirm, setSkipVersion, updateInfo?.latest_version, navigateTo]
  );

  const handlePrompt = React.useCallback(
    (
      orchestVersion: OrchestVersion,
      updateInfo: UpdateInfo,
      skipVersion: string | null,
      shouldPromptNoUpdate: boolean
    ) => {
      const currentVersion = orchestVersion.version;
      const latestVersion = updateInfo.latest_version;

      const shouldPromptUpdate = shouldPromptOrchestUpdate(
        currentVersion,
        latestVersion,
        skipVersion
      );
      if (shouldPromptUpdate) {
        promptUpdate(currentVersion, latestVersion);
      } else if (shouldPromptNoUpdate) {
        setConfirm(
          "No update available",
          "There doesn't seem to be a new update available."
        );
      }
    },
    [setConfirm, promptUpdate]
  );

  const checkUpdateNow = async () => {
    // Use fetcher directly instead of mutate function from the SWR
    // calls to prevent updating the values which would trigger the
    // useEffect and thereby prompting the user twice. In addition,
    // we want to be able to tell the user that no update is available
    // if this function is invoked.
    const [fetchedOrchestVersion, fetchedUpdateInfo] = await Promise.all([
      fetcher<OrchestVersion>("/async/version"),
      fetcher<UpdateInfo>("/async/orchest-update-info"),
    ]);

    if (fetchedOrchestVersion && fetchedUpdateInfo) {
      handlePrompt(fetchedOrchestVersion, fetchedUpdateInfo, null, true);
    }
  };

  React.useEffect(() => {
    if (orchestVersion && updateInfo) {
      handlePrompt(orchestVersion, updateInfo, skipVersion, false);
    }
  }, [orchestVersion, updateInfo, skipVersion, handlePrompt]);

  return checkUpdateNow;
};
