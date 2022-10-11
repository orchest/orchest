import { useGlobalContext } from "@/contexts/GlobalContext";
import React from "react";

/** Hide Intercom in case the UI component is blocked by it */
export const useHideIntercom = (
  shouldHidIntercom: boolean,
  shouldAutoShow = true
) => {
  const { hideIntercom, showIntercom } = useGlobalContext();

  React.useEffect(() => {
    if (shouldHidIntercom) {
      hideIntercom();
    } else if (shouldAutoShow) {
      showIntercom();
    }
  }, [shouldHidIntercom, hideIntercom, showIntercom, shouldAutoShow]);
};
