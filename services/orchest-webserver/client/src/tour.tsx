import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { hasValue } from "@orchest/lib-utils";
import { StepType, TourProps, useTour } from "@reactour/tour";
import React from "react";
import create from "zustand";
import { useNavigate } from "./hooks/useCustomRoute";

/** Will be used as a data attribute of the DOM element. */
type ProductTourStep = "pipeline-editor";

type ProductTour = {
  /** The serial number of the current tour step. Set as null to indicate that user finishes or disable tour. */
  progress: undefined | ProductTourStep | null;
  disable: () => void;
  pause: () => void;
  resume: (stepName?: ProductTourStep) => void;
};

type NavigateFunction = ReturnType<typeof useNavigate>;

const useProductTourStore = (
  { setIsOpen, setCurrentStep }: TourProps,
  navigate: NavigateFunction
) =>
  create<ProductTour>((set, get) => {
    return {
      progress: undefined,
      disable: () => {
        setIsOpen(false);
        set({ progress: null });
      },
      pause: () => setIsOpen(false),
      resume: (stepName?: ProductTourStep) => {
        const progress = stepName ?? get().progress;
        if (hasValue(progress)) {
          steps[progress].setup(navigate);
          setCurrentStep(progressStepMapping[progress]);

          // setIsOpen(true);

          window.setTimeout(() => {
            setIsOpen(true);
          }, 3000);
        }
      },
    };
  });

export function useProductTour<U>(
  selector: (state: ProductTour) => U,
  equals?: (a: U, b: U) => boolean
) {
  const tourProps = useTour();
  const navigate = useNavigate();
  return useProductTourStore(tourProps, navigate)(selector, equals);
}

export const progressStepMapping: Record<ProductTourStep, number> = {
  "pipeline-editor": 0,
};

const steps: Record<
  ProductTourStep,
  {
    content: React.ReactElement;
    setup: (navigate: NavigateFunction) => void;
  }
> = {
  "pipeline-editor": {
    content: (
      <Box>
        <Typography variant="h6">Pipeline editor</Typography>
        <Typography variant="body1">
          Pipelines are made up of Steps and connections. Connections define how
          data flows and the order of step execution.
        </Typography>
      </Box>
    ),
    setup: (navigate) => {
      navigate({ route: "pipeline", sticky: false });
    },
  },
};

export const stepList: StepType[] = Object.entries(steps).map(
  ([stepName, { content }]) => ({
    selector: `[data-tour-step=${stepName}]`,
    content,
  })
);

export const useTourStep = (step: ProductTourStep | undefined) => {
  const { setIsOpen, currentStep, isOpen } = useTour();
  React.useEffect(() => {
    if (step && !isOpen && currentStep === progressStepMapping[step]) {
      setIsOpen(true);
    }
  }, [currentStep, setIsOpen, step, isOpen]);
};
