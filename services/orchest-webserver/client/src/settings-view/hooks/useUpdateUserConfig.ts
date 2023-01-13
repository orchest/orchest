import {
  useOrchestConfigsApi,
  useRequireRestart,
} from "@/api/system-config/useOrchestConfigsApi";
import { useAsync } from "@/hooks/useAsync";
import { OrchestUserConfig } from "@/types";
import { equalsShallow } from "@/utils/record";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useParseUserConfigValue } from "./useParseUserConfigValue";

/**
 * Watches the changes of `shouldSave` and `value` and update user config accordingly.
 * Returns the error if unsuccessful.
 */
export const useUpdateUserConfig = (
  shouldSave: boolean,
  value: string | undefined
) => {
  const updateUserConfig = useOrchestConfigsApi((state) => state.update);
  const setRequireRestart = useRequireRestart(
    (state) => state.setRequireRestart
  );
  const userConfig = useOrchestConfigsApi((state) => state.userConfig);

  const userConfigRef = React.useRef(userConfig);
  userConfigRef.current = userConfig;

  const parseValue = useParseUserConfigValue();
  const { run, setError, error: updateConfigError } = useAsync<
    (keyof OrchestUserConfig)[]
  >();
  const saveUserConfig = React.useCallback(async () => {
    if (!hasValue(value)) return;
    try {
      const config = parseValue(value);
      setError(undefined);
      // Only update if the value of the config properties are actually changed.
      // Ignore meaningless typing changes, e.g. spaces.
      const configHasChanged =
        hasValue(userConfigRef.current) &&
        !equalsShallow(userConfigRef.current, config);

      if (configHasChanged) {
        userConfigRef.current = config;
        const requireRestart = await run(updateUserConfig(config));
        setRequireRestart(requireRestart);
      }
    } catch (error) {
      setError(error);
    }
  }, [value, parseValue, run, setError, updateUserConfig, setRequireRestart]);

  React.useEffect(() => {
    if (shouldSave) saveUserConfig();
  }, [saveUserConfig, shouldSave]);

  return updateConfigError;
};
