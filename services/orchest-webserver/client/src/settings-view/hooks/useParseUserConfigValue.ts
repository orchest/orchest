import { useOrchestConfigsApi } from "@/api/system-config/useOrchestConfigsApi";
import { OrchestUserConfig } from "@/types";
import React from "react";
import { extractUneditable } from "../common";

/**
 * Returns a function that can parse the user config string and return the full
 * orchest config object.
 */
export const useParseUserConfigValue = () => {
  const fixedConfig = useOrchestConfigsApi((state) => {
    if (!state.config) return;
    return extractUneditable(state.config, state.userConfig || {});
  });

  const parseUserConfigString = React.useCallback(
    (userConfigString: string): OrchestUserConfig => {
      try {
        return { ...fixedConfig, ...JSON.parse(userConfigString) };
      } catch (error) {
        throw new Error("Invalid JSON");
      }
    },
    [fixedConfig]
  );

  return parseUserConfigString;
};
