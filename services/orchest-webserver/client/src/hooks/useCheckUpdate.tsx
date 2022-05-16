import { Code } from "@/components/common/Code";
import { useAppContext } from "@/contexts/AppContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { siteMap } from "@/routingConfig";
import { OrchestVersion, UpdateInfo } from "@/types";
import Typography from "@mui/material/Typography";
import { fetcher, hasValue } from "@orchest/lib-utils";
import React from "react";
import useSWRImmutable from "swr/immutable";
import { useCancelablePromise } from "./useCancelablePromise";

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
  if (!hasValue(latestVersion)) return false;
  if (isVersionLTE(latestVersion, currentVersion)) return false;
  return skipVersion !== latestVersion;
};

const fetchOrchestVersion = () =>
  fetcher<OrchestVersion>("/async/version").then(
    (response) => response.version
  );

const fetchLatestVersion = () =>
  fetcher<UpdateInfo>("/async/orchest-update-info").then(
    (response) => response.latest_version
  );

// To limit the number of api calls and make sure only one prompt is shown,
// it is best to place this hook in top-level components (i.e. the ones
// defined in the routingConfig.tsx).
export const useCheckUpdate = () => {
  const { setConfirm, setAlert } = useAppContext();
  const { navigateTo } = useCustomRoute();

  const [skipVersion, setSkipVersion] = useLocalStorage<string | null>(
    "skip_version",
    null
  );

  // Only make requests every hour, because the latest Orchest version gets
  // fetched once per hour. Use `useSWRImmutable` to disable all kinds of
  // automatic revalidation; just serve from cache and refresh cache
  // once per hour.
  const { data: orchestVersion } = useSWRImmutable(
    true ? null : "/async/version",
    fetchOrchestVersion,
    { refreshInterval: 3600000 }
  );
  const { data: latestVersion } = useSWRImmutable(
    true ? null : "/async/orchest-update-info",
    fetchLatestVersion,
    { refreshInterval: 3600000 }
  );

  const promptUpdate = React.useCallback(
    (localVersion: string, versionToUpdate: string) => {
      setConfirm(
        "Update available",
        <>
          <Typography variant="body2">
            {`Orchest can be updated from `}
            <Code>{localVersion}</Code> to <Code>{versionToUpdate}</Code> .
            Would you like to update now?
          </Typography>
          <Typography variant="body2" sx={{ marginTop: 4 }}>
            {`Check out the `}
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
            setSkipVersion(versionToUpdate);
            resolve(false);
            return false;
          },
          confirmLabel: "Update",
          cancelLabel: "Skip this version",
        }
      );
    },
    [setConfirm, setSkipVersion, navigateTo]
  );

  const handlePrompt = React.useCallback(
    (
      localVersion: OrchestVersion["version"],
      versionToUpdate: UpdateInfo["latest_version"],
      skipVersion: string | null | undefined,
      shouldPromptNoUpdate: boolean
    ) => {
      if (!localVersion || !versionToUpdate) return;

      const shouldPromptUpdate = shouldPromptOrchestUpdate(
        localVersion,
        versionToUpdate,
        skipVersion
      );
      if (shouldPromptUpdate) {
        promptUpdate(localVersion, versionToUpdate);
      } else if (shouldPromptNoUpdate) {
        setAlert(
          "No update available",
          "There doesn't seem to be a new update available."
        );
      }
    },
    [setAlert, promptUpdate]
  );

  const { makeCancelable } = useCancelablePromise();

  const checkUpdateNow = React.useCallback(async () => {
    // Use fetcher directly instead of mutate function from the SWR
    // calls to prevent updating the values which would trigger the
    // useEffect and thereby prompting the user twice. In addition,
    // we want to be able to tell the user that no update is available
    // if this function is invoked.
    const [fetchedOrchestVersion, fetchedLatestVersion] = await makeCancelable(
      Promise.all([fetchOrchestVersion(), fetchLatestVersion()])
    );

    if (fetchedOrchestVersion && fetchedLatestVersion) {
      handlePrompt(fetchedOrchestVersion, fetchedLatestVersion, null, true);
    }
  }, [handlePrompt, makeCancelable]);

  React.useEffect(() => {
    if (orchestVersion && latestVersion) {
      handlePrompt(orchestVersion, latestVersion, skipVersion, false);
    }
  }, [orchestVersion, latestVersion, skipVersion, handlePrompt]);

  return checkUpdateNow;
};
