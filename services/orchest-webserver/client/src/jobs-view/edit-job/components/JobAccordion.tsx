import { Accordion } from "@/components/Accordion";
import { AccordionProps } from "@mui/material/Accordion";
import React from "react";
import create from "zustand";

type JobAccordions = {
  isOverviewOpen: boolean;
  isParametersOpen: boolean;
  isEnvVarsOpen: boolean;
  setIsOverviewOpen: (value: boolean) => void;
  setIsParametersOpen: (value: boolean) => void;
  setIsEnvVarsOpen: (value: boolean) => void;
  reset: () => void;
};

export const useJobAccordions = create<JobAccordions>((set) => ({
  isOverviewOpen: true,
  isParametersOpen: true,
  isEnvVarsOpen: true,

  setIsOverviewOpen: (value) => set({ isOverviewOpen: value }),
  setIsParametersOpen: (value) => set({ isParametersOpen: value }),
  setIsEnvVarsOpen: (value) => set({ isEnvVarsOpen: value }),

  reset: () =>
    set({
      isOverviewOpen: true,
      isEnvVarsOpen: true,
    }),
}));

export const JobAccordion = (props: AccordionProps) => {
  const { reset } = useJobAccordions();
  React.useEffect(() => {
    return () => reset();
  }, [reset]);

  return <Accordion {...props} />;
};
