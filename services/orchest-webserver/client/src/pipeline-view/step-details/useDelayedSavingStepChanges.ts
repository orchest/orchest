import { useDebounce } from "@/hooks/useDebounce";
import { StepState } from "@/types";
import React from "react";
import { useStepDetailsContext } from "./StepDetailsContext";

export const useDelayedSavingStepChanges = (
  onSave: (payload: Partial<StepState>, uuid: string) => void
) => {
  const { step: initialStepState } = useStepDetailsContext();
  const [step, setStep] = React.useState<StepState>(initialStepState);

  const setStepChanges = React.useCallback(
    (changes: React.SetStateAction<Partial<StepState>>) => {
      setStep((current) => {
        const mutations =
          changes instanceof Function ? changes(current) : changes;
        return { ...current, ...mutations };
      });
    },
    []
  );

  const updatedStep = useDebounce(step, 250);

  React.useEffect(() => {
    onSave(updatedStep, step.uuid);
  }, [updatedStep, onSave, step.uuid]);

  return { step, setStepChanges };
};
