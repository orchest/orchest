// @ts-check
import React from "react";
import { DIALOG_ANIMATION_DURATION } from "@orchest/design-system";
import { useLocalStorage } from "@/hooks/local-storage";
import { useProjects } from "@/hooks/projects";
import useSWR from "swr";

export const useOnboardingDialog = () => {
  const {
    data: isDialogOpen,
    mutate: setIsDialogOpen,
  } = useSWR("use-onboarding-dialog.open", { initialData: false });

  const {
    data: shouldFetchQuickstart,
    mutate: setShouldFetchQuickstart,
  } = useSWR("use-onboarding-dialog.fetch", { initialData: false });
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useLocalStorage(
    "onboarding_completed",
    false
  );

  const { data } = useProjects({ shouldFetch: shouldFetchQuickstart });
  const findQuickstart = data?.find((project) => project.path === "quickstart");
  const quickstart =
    typeof findQuickstart === "undefined"
      ? undefined
      : {
          project_uuid: findQuickstart.uuid,
          pipeline_uuid: "0915b350-b929-4cbd-b0d4-763cac0bb69f",
        };
  const hasQuickstart = typeof quickstart !== "undefined";

  /** @type import('./types').TSetIsOnboardingDialogOpen */
  const setIsOnboardingDialogOpen = (isOpen, onOpen) => {
    if (isOpen) {
      setIsDialogOpen(true);
      setShouldFetchQuickstart(true);
    } else {
      setIsDialogOpen(false);
      setHasCompletedOnboarding(true);
      // Wait for Dialog transition to finish before resetting position.
      // This way we avoid showing the slides animating back to the start.
      setTimeout(() => {
        setShouldFetchQuickstart(false);
        onOpen && onOpen(false);
      }, DIALOG_ANIMATION_DURATION.OUT);
    }
  };

  React.useEffect(() => {
    if (!hasCompletedOnboarding) setIsOnboardingDialogOpen(true);
  }, []);

  return {
    isOnboardingDialogOpen: isDialogOpen,
    setIsOnboardingDialogOpen,
    quickstart,
    hasQuickstart,
  };
};
