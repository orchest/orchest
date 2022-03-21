import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useImportUrl } from "@/hooks/useImportUrl";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

export const useOnboardingDialog = () => {
  const {
    state: { isShowingOnboarding },
    dispatch,
  } = useAppContext();

  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useLocalStorage(
    "onboarding_completed",
    false
  );

  const projectsContext = useProjectsContext();
  const [importUrl] = useImportUrl();

  const findQuickstart = projectsContext.state.projects?.find(
    (project) => project.path === "quickstart"
  );
  const quickstart =
    typeof findQuickstart === "undefined"
      ? undefined
      : {
          project_uuid: findQuickstart.uuid,
          pipeline_uuid: "0915b350-b929-4cbd-b0d4-763cac0bb69f",
        };
  const hasQuickstart = typeof quickstart !== "undefined";

  const setIsOnboardingDialogOpen = React.useCallback(
    (isOpen: boolean, onOpen?: (value: boolean) => void) => {
      dispatch({ type: "SET_IS_SHOWING_ONBOARDING", payload: isOpen });
      if (!isOpen) {
        // update localstorage
        setHasCompletedOnboarding(true);
        // update app context
        dispatch({ type: "SET_HAS_COMPLETED_ONBOARDING", payload: true });
        // Wait for Dialog transition to finish before resetting position.
        // This way we avoid showing the slides animating back to the start.

        onOpen && onOpen(false);
      }
    },
    [dispatch, setHasCompletedOnboarding]
  );

  React.useEffect(() => {
    dispatch({
      type: "SET_HAS_COMPLETED_ONBOARDING",
      payload: hasCompletedOnboarding,
    });
    if (!hasCompletedOnboarding) setIsOnboardingDialogOpen(true);
  }, [dispatch, hasCompletedOnboarding, setIsOnboardingDialogOpen]);

  return {
    isOnboardingDialogOpen: isShowingOnboarding,
    setIsOnboardingDialogOpen,
    quickstart,
    hasImportUrl: hasValue(importUrl) && importUrl !== "",
    hasQuickstart,
  };
};
