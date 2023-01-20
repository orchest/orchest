import { Code } from "@/components/common/Code";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { siteMap } from "@/routingConfig";
import { OrchestVersion, UpdateInfo } from "@/types";
import Typography from "@mui/material/Typography";
import { fetcher, hasValue } from "@orchest/lib-utils";
import React from "react";
import { useCancelablePromise } from "./useCancelablePromise";
import { useFetcher } from "./useFetcher";
import { useInterval } from "./useInterval";
import { useMatchRoutePaths } from "./useMatchProjectRoot";

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

const fetchLatestVersion = (cache?: boolean) => {
  const endpoint = `/async/orchest-update-info?cache=${cache}`;
  return fetcher<UpdateInfo>(endpoint).then(
    (response) => response.latest_version
  );
};

const requestToCheckVersions = async ({
  cache = true,
}: {
  cache?: boolean;
}) => {
  const [orchestVersion, latestVersion] = await Promise.all([
    fetchOrchestVersion(),
    fetchLatestVersion(cache),
  ]);

  return [orchestVersion, latestVersion] as const;
};

const useOrchestVersion = () => {
  const { data, fetchData } = useFetcher<OrchestVersion, string>(
    "/async/version",
    { transform: (data) => data.version }
  );

  return { orchestVersion: data, fetchOrchestVersion: fetchData };
};

const useLatestVersion = () => {
  const { data, fetchData } = useFetcher<UpdateInfo, string | null>(
    "/async/orchest-update-info",
    { transform: (data) => data.latest_version }
  );

  return { latestVersion: data, fetchLatestVersion: fetchData };
};

const useVersionsPoller = () => {
  const { orchestVersion, fetchOrchestVersion } = useOrchestVersion();
  const { latestVersion, fetchLatestVersion } = useLatestVersion();

  // Only check the latest version every hour, because the latest Orchest version gets
  // fetched once per hour.
  useInterval(() => {
    fetchLatestVersion();
  }, 3600000);

  return { orchestVersion, fetchOrchestVersion, latestVersion };
};

// To limit the number of api calls and make sure only one prompt is shown,
// it is best to place this hook in top-level components (i.e. the ones
// defined in the routingConfig.tsx).
export const useCheckUpdate = () => {
  const { setConfirm, setAlert } = useGlobalContext();
  const { navigateTo, location } = useCustomRoute();

  const [skipVersion, setSkipVersion] = useLocalStorage<string | null>(
    "skip_version",
    null
  );

  // Only check update on mount if the route path matches the following:
  const match = useMatchRoutePaths([
    siteMap.home,
    siteMap.settings,
    siteMap.help,
  ]);
  const {
    orchestVersion,
    fetchOrchestVersion,
    latestVersion,
  } = useVersionsPoller();

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
          confirmLabel: "Go to Update view",
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

  const checkUpdate = React.useCallback(async () => {
    // Use fetcher directly instead of mutate function from the SWR
    // calls to prevent updating the values which would trigger the
    // useEffect and thereby prompting the user twice. In addition,
    // we want to be able to tell the user that no update is available
    // if this function is invoked.
    const [fetchedOrchestVersion, fetchedLatestVersion] = await makeCancelable(
      requestToCheckVersions({ cache: false })
    );

    if (fetchedOrchestVersion && fetchedLatestVersion) {
      handlePrompt(fetchedOrchestVersion, fetchedLatestVersion, null, true);
    }
  }, [handlePrompt, makeCancelable]);

  React.useEffect(() => {
    // When location is changed (i.e. user is navigating), check if match is valid and then execute handlePrompt.
    if (orchestVersion && latestVersion && match) {
      handlePrompt(orchestVersion, latestVersion, skipVersion, false);
    }
  }, [
    orchestVersion,
    latestVersion,
    skipVersion,
    handlePrompt,
    match,
    location,
  ]);

  return { orchestVersion, fetchOrchestVersion, checkUpdate };
};
