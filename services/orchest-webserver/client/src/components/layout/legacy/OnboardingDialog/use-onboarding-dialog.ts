import { useGlobalContext } from "@/contexts/GlobalContext";
import { useFetchProjects } from "@/hooks/useFetchProjects";
import { useImportUrlFromQueryString } from "@/hooks/useImportUrl";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

export const useOnboardingDialog = () => {
  const { projects } = useFetchProjects();
  const {
    state: { isShowingOnboarding },
    dispatch,
  } = useGlobalContext();

  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useLocalStorage(
    "onboarding_completed",
    false
  );

  const [importUrl] = useImportUrlFromQueryString();

  const quickstartProject = Object.values(projects)?.find(
    (project) => project.path === "quickstart"
  );

  const quickstart =
    typeof quickstartProject === "undefined"
      ? undefined
      : {
          project_uuid: quickstartProject.uuid,
          pipeline_uuid: "0915b350-b929-4cbd-b0d4-763cac0bb69f",
        };

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
  };
};
