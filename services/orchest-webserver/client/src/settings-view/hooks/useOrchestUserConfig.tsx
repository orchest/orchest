import { OrchestConfig, OrchestUserConfig } from "@/types";
import { fetcher, HEADER } from "@orchest/lib-utils";
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
    if (!userConfigJson || !orchestConfig) return;
    let visibleJSON = configToVisibleConfig(orchestConfig, userConfigJson);
    _setUserConfig(JSON.stringify(visibleJSON, null, 2));
  }, [orchestConfig, userConfigJson, _setUserConfig]);

  const [requiresRestart, setRequiresRestart] = React.useState<string[]>([]);

  const [saveUserConfigError, setSaveUserConfigError] = React.useState<
    string
  >();

  const saveUserConfig = React.useCallback(async () => {
    if (!userConfig || !orchestConfig) return;

    try {
      let visibleJSON = JSON.parse(userConfig);
      let invisibleConfigJSON = configToInvisibleConfig(
        orchestConfig,
        userConfigJson || {}
      );
      let joinedConfig = { ...invisibleConfigJSON, ...visibleJSON };

      setUserConfigJson(joinedConfig);

      await fetcher<{
        requires_restart: string[];
        user_config: OrchestUserConfig;
      }>("/async/user-config", {
        method: "POST",
        headers: HEADER.JSON,
        body: JSON.stringify({ config: JSON.stringify(joinedConfig) }),
      })
        .then(({ user_config, requires_restart }) => {
          setRequiresRestart(requires_restart);
          setUserConfigJson(user_config);
          _setUserConfig(
            JSON.stringify(
              configToVisibleConfig(orchestConfig, user_config),
              null,
              2
            )
          );
        })
        .catch((error) => {
          setSaveUserConfigError(error?.message);
        });
      setAsSaved(true);
    } catch (error) {
      setSaveUserConfigError(error?.message || error);
    }
  }, [
    orchestConfig,
    setAsSaved,
    _setUserConfig,
    setUserConfigJson,
    userConfig,
    userConfigJson,
  ]);

  return {
    userConfig,
    setUserConfig,
    saveUserConfig,
    requiresRestart,
    setRequiresRestart,
    saveUserConfigError,
  };
};
