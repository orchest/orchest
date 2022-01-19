import { useAppContext } from "@/contexts/AppContext";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { OrchestVersion, UpdateInfo } from "@/types";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import useSWR from "swr";

export const UpdateDialog: React.FC = () => {
  const [skipVersion, setSkipVersion] = useLocalStorage("skip_version", null);
  const [state, setState] = React.useState({
    isOpen: false,
  });

  const { setConfirm } = useAppContext();

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
  // fetched once per hour.
  // TODO: should become instead `import useSWRImmutable from 'swr/immutable'` ?
  const { data: updateInfo } = useSWR<UpdateInfo>(
    "/async/orchest-update-info",
    fetcher,
    { refreshInterval: 3600000 }
  );
  const { data: orchestVersion } = useSWR<OrchestVersion>(
    "/async/version",
    fetcher,
    { refreshInterval: 3600000 }
  );

  // TODO: This code should run the moment both SWR hooks are done.
  let shouldPrompt = false;
  if (updateInfo && orchestVersion) {
    console.log("CHECKING PROMPT CHECK");
    // shouldPrompt = shouldPromptOrchestUpdate(orchestVersion.version, updateInfo.latest_version, skipVersion);

    // TODO: remove as this is for development to trigger it.
    shouldPrompt = shouldPromptOrchestUpdate(
      orchestVersion.version,
      "v2022.10.1",
      skipVersion
    );
  }
  console.log("Version", orchestVersion);
  console.log("SHOULD PROMPT", shouldPrompt);
  console.log("IS OPEN", state.isOpen);

  if (!state.isOpen && shouldPrompt) {
    console.log("DOING THE SETCONFIRM THING");
    setState({ isOpen: true });
    console.log("IS OPEN", state.isOpen);

    // TODO: make the version use the <Code>
    setConfirm(
      "Update available",
      `Orchest can be updated from ${orchestVersion.version} to ${updateInfo.latest_version}. Would you like to update?`,
      async (resolve) => {
        // TODO: Add code to actually do the update
        console.log("DO UPDATE");
        resolve(true);
        return true;
      },
      async (resolve) => {
        // TODO: The button on the confirm modal should actually be
        // "SKIP THIS VERSION" and instead of confirm would be cool
        // if its "UPDATE". Do I need to make my cystom <Dialog>?
        console.log("Skip this version.");
        setSkipVersion(updateInfo.latest_version);
        resolve(false);
        return false;
      }
    ).then(() => {
      console.log("IS OPEN is NOW", state.isOpen);
      setState({ isOpen: false });
    });
  }

  return <div></div>;
};
