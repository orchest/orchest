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

type UpdateDialogProps = {
  skipVersion?: string | null;
};

export const UpdateDialog: React.FC<UpdateDialogProps> = (props) => {
  let [skipVersion, setSkipVersion] = useLocalStorage("skip_version", null);

  // The value passed through props overrules the localStorage value
  // so that we can manually trigger to show the dialog.
  skipVersion = props.skipVersion || skipVersion;

  console.log("SKIPVERSION:", skipVersion);
  const [state, setState] = React.useState({
    isOpen: false,
  });

  const { setConfirm } = useAppContext();
  const { navigateTo } = useCustomRoute();

  const updateView = () => {
    navigateTo(siteMap.update.path);
  };

  const shouldPromptOrchestUpdate = (
    currentVersion: string,
    latestVersion: string | null,
    skipVersion: string | null
  ) => {
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

  // Only make requests every hour, because the latest Orchest version gets
  // fetched once per hour. Use `useSWRImmutable` to disable all kinds of
  // automatic revalidation; just serve from cache and refresh cache
  // once per hour.
  const { data: updateInfo } = useSWRImmutable<UpdateInfo>(
    "/async/orchest-update-info",
    fetcher,
    { refreshInterval: 3600000 }
  );
  const { data: orchestVersion } = useSWRImmutable<OrchestVersion>(
    "/async/version",
    fetcher,
    { refreshInterval: 3600000 }
  );

  let shouldPrompt = false;
  if (updateInfo && orchestVersion) {
    // shouldPrompt = shouldPromptOrchestUpdate(orchestVersion.version, updateInfo.latest_version, skipVersion);

    // TODO: remove as this is for development to trigger it.
    shouldPrompt = shouldPromptOrchestUpdate(
      orchestVersion.version,
      "v2022.10.1",
      skipVersion
    );
  }

  if (!state.isOpen && shouldPrompt) {
    setState({ isOpen: true });

    setConfirm(
      "Update available",
      <Typography variant="body2">
        Orchest can be updated from <Code>{orchestVersion.version}</Code> to{" "}
        <Code>{updateInfo.latest_version}</Code>. Would you like to update now?
      </Typography>,
      {
        onConfirm: async (resolve) => {
          console.log("DO UPDATE");
          updateView();
          resolve(true);
          return true;
        },
        onCancel: async (resolve) => {
          console.log("Skip this version.");
          // TODO: just for development to test.
          // setSkipVersion(updateInfo.latest_version);
          setSkipVersion("v2022.10.1");
          resolve(false);
          return false;
        },
        confirmLabel: "Update",
        cancelLabel: "Skip this version",
      }
    ).then(() => {
      setState({ isOpen: false });
    });
  }

  return <div></div>;
};
