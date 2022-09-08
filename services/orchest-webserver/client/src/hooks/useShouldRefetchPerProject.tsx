import { useRegainBrowserTabFocus } from "@/hooks/useFocusBrowserTab";
import { useHasChanged } from "@/hooks/useHasChanged";
import { useCustomRoute } from "./useCustomRoute";

export const useShouldRefetchPerProject = () => {
  const { projectUuid } = useCustomRoute();

  const hasRegainedFocus = useRegainBrowserTabFocus();
  const hasChangedProject = useHasChanged(projectUuid);

  return hasRegainedFocus || hasChangedProject;
};
