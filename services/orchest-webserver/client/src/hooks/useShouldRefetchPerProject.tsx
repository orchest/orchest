import { useRegainBrowserTabFocus } from "@/hooks/useFocusBrowserTab";
import { useHasChanged } from "@/hooks/useHasChanged";
import { hasValue } from "@orchest/lib-utils";
import { useCustomRoute } from "./useCustomRoute";

export const useShouldRefetchPerProject = () => {
  const { projectUuid } = useCustomRoute();

  const hasRegainedFocus = useRegainBrowserTabFocus();
  const hasChangedProject = useHasChanged(
    projectUuid,
    (prev, curr) => hasValue(prev) && prev !== curr
  );

  return hasRegainedFocus || hasChangedProject;
};
