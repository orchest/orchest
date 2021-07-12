import { useOnboardingDialog } from "./OnboardingDialog";

export const useLayout = () => {
  const {
    isOnboardingDialogOpen,
    setIsOnboardingDialogOpen,
  } = useOnboardingDialog();

  return { isOnboardingDialogOpen, setIsOnboardingDialogOpen };
};
