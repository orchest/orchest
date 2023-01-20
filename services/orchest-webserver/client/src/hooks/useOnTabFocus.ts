import React from "react";
import { useFocusBrowserTab } from "./useFocusBrowserTab";

export const useOnBrowserTabFocus = (listener: () => void) => {
  const didFocusTab = useFocusBrowserTab();

  React.useEffect(() => {
    if (didFocusTab) listener();
  }, [listener, didFocusTab]);
};
