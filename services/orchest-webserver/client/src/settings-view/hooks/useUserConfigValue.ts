import { useOrchestConfigsApi } from "@/api/system-config/useOrchestConfigsApi";
import { useTextField } from "@/hooks/useTextField";
import React from "react";
import { extractEditable } from "../common";

/**
 * A hook that holds the state of the text field of user config.
 */
export const useUserConfigValue = () => {
  const orchestConfig = useOrchestConfigsApi((state) => state.config);
  const userConfig = useOrchestConfigsApi((state) => state.userConfig);

  const editableConfig = React.useMemo(() => {
    if (!orchestConfig || !userConfig) return;
    return extractEditable(orchestConfig, userConfig);
  }, [orchestConfig, userConfig]);

  const textField = useTextField((value) => {
    if (!value) return true;
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  });
  const { value, initValue } = textField;
  React.useEffect(() => {
    if (editableConfig && !value)
      initValue(JSON.stringify(editableConfig, null, 2));
  }, [editableConfig, value, initValue]);

  return textField;
};
