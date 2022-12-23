import { hasValue } from "@orchest/lib-utils";
import React from "react";

/** Hide Intercom in case the UI component is blocked by it */
export const useHideIntercom = (
  shouldHidIntercom: boolean,
  shouldAutoShow = true
) => {
  const setDisplayOfIntercom = React.useCallback((value: "block" | "none") => {
    const intercomElement = document.querySelector(
      ".intercom-lightweight-app"
    ) as HTMLElement;

    if (hasValue(intercomElement?.style?.display))
      intercomElement.style.display = value;
  }, []);

  const hideIntercom = React.useCallback(() => {
    setDisplayOfIntercom("none");
  }, [setDisplayOfIntercom]);

  const showIntercom = React.useCallback(() => {
    setDisplayOfIntercom("block");
  }, [setDisplayOfIntercom]);
  React.useEffect(() => {
    if (shouldHidIntercom) {
      hideIntercom();
    } else if (shouldAutoShow) {
      showIntercom();
    }
  }, [shouldHidIntercom, hideIntercom, showIntercom, shouldAutoShow]);
};
