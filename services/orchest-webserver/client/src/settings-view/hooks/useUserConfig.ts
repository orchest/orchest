import { useDebounce } from "@/hooks/useDebounce";
import { useHasChanged } from "@/hooks/useHasChanged";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useUpdateUserConfig } from "./useUpdateUserConfig";
import { useUserConfigValue } from "./useUserConfigValue";

/** Provide a state as the user config string value.
 *  If the value is with a valid JSON format, send a request to update user config.  */
export const useUserConfig = () => {
  const textField = useUserConfigValue();
  const debouncedValue = useDebounce(textField.value, 250);
  const hasChanged = useHasChanged(
    debouncedValue,
    (prev, curr) => hasValue(prev) && prev.length > 0 && prev !== curr
  );
  const error = useUpdateUserConfig(hasChanged, debouncedValue);
  const { setValue } = textField;
  const prettify = React.useCallback(() => {
    setValue((currentValue) => {
      try {
        return JSON.stringify(JSON.parse(currentValue), null, 2);
      } catch (error) {
        return currentValue;
      }
    });
  }, [setValue]);

  return { ...textField, prettify, error };
};
