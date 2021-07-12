import * as React from "react";
import { DIALOG_ANIMATION_DURATION } from "@orchest/design-system";
import { useLocalStorage } from "@/hooks/local-storage";
import { useProjects } from "@/hooks/projects";
import useSWR from "swr";

export const useOnboardingDialog = () => {
  const { data: state, mutate: setState } = useSWR(
    "useOnboardingDialog",
    null,
    {
      initialData: { isOpen: false, shouldFetchQuickstart: false },
    }
  );

  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useLocalStorage(
    "onboarding_completed",
    false
  );

  const { data } = useProjects({ shouldFetch: state?.shouldFetchQuickstart });
  const findQuickstart = data?.find((project) => project.path === "quickstart");
  const quickstart =
    typeof findQuickstart === "undefined"
      ? undefined
      : {
          project_uuid: findQuickstart.uuid,
          pipeline_uuid: "0915b350-b929-4cbd-b0d4-763cac0bb69f",
        };
  const hasQuickstart = typeof quickstart !== "undefined";

  const setIsOnboardingDialogOpen = (
    isOpen: boolean,
    onOpen?: (boolean) => void
  ) => {
    if (isOpen) {
      setState({ isOpen: true, shouldFetchQuickstart: true });
    } else {
      setState((prevState) => ({ ...prevState, isOpen: false }));

      setHasCompletedOnboarding(true);
      // Wait for Dialog transition to finish before resetting position.
      // This way we avoid showing the slides animating back to the start.
      setTimeout(() => {
        setState((prevState) => ({
          ...prevState,
          shouldFetchQuickstart: false,
        }));
        onOpen && onOpen(false);
      }, DIALOG_ANIMATION_DURATION.OUT);
    }
  };

  React.useEffect(() => {
    if (!hasCompletedOnboarding) setIsOnboardingDialogOpen(true);
  }, []);

  return {
    isOnboardingDialogOpen: state?.isOpen,
    setIsOnboardingDialogOpen,
    quickstart,
    hasQuickstart,
  };
};
