import { OrchestConfig, OrchestUserConfig } from "@/types";
import { fetcher } from "@orchest/lib-utils";
import "codemirror/mode/javascript/javascript";
import React from "react";
import { configToInvisibleConfig, configToVisibleConfig } from "../common";
import { useOrchestUserConfigJson } from "./useOrchestUserConfigJson";

export const useOrchestUserConfig = (
  setAsSaved: (value?: boolean | undefined) => void,
  orchestConfig: OrchestConfig | undefined
) => {
  const { userConfigJson, setUserConfigJson } = useOrchestUserConfigJson(
    orchestConfig
  );
  // text representation of config object, filtered for certain keys
  const [userConfig, _setUserConfig] = React.useState<string>();

  const setUserConfig = React.useCallback(
    (data: React.SetStateAction<string | undefined>) => {
      _setUserConfig(data);
      setAsSaved(false);
    },
    [_setUserConfig, setAsSaved]
  );

  React.useEffect(() => {
    if (!userConfigJson) return;
    let visibleJSON = configToVisibleConfig(orchestConfig, userConfigJson);
    _setUserConfig(JSON.stringify(visibleJSON, null, 2));
  }, [orchestConfig, userConfigJson, _setUserConfig]);

  const [requiresRestart, setRequiresRestart] = React.useState<string[]>([]);

  const [saveConfigError, setSaveConfigError] = React.useState<string>();

  const saveConfig = React.useCallback(async () => {
    if (!userConfig) return;

    try {
      let visibleJSON = JSON.parse(userConfig);
      let invisibleConfigJSON = configToInvisibleConfig(
        orchestConfig,
        userConfigJson || {}
      );
      let joinedConfig = { ...invisibleConfigJSON, ...visibleJSON };

      setUserConfigJson(joinedConfig);

      let formData = new FormData();
      formData.append("config", JSON.stringify(joinedConfig));

      await fetcher<{
        requires_restart: string[];
        user_config: OrchestUserConfig;
      }>("/async/user-config", { method: "POST", body: formData })
        .then(({ user_config, requires_restart }) => {
          setRequiresRestart(requires_restart);
          setUserConfigJson(user_config);
          setUserConfig(
            JSON.stringify(
              configToVisibleConfig(orchestConfig, user_config),
              null,
              2
            )
          );
        })
        .catch((error) => {
          setSaveConfigError(error?.message);
        });
      setAsSaved(true);
    } catch (error) {
      console.error(`Tried to save config which is invalid JSON. ${error}`);
      console.error(userConfig);
    }
  }, [
    orchestConfig,
    setAsSaved,
    setUserConfig,
    setUserConfigJson,
    userConfig,
    userConfigJson,
  ]);

  return {
    userConfig,
    setUserConfig,
    saveConfig,
    requiresRestart,
    setRequiresRestart,
    saveConfigError,
  };
};
