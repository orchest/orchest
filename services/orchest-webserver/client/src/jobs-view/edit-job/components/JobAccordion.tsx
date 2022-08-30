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

export const useJobOverviewAccordion = () => {
  const isOverviewOpen = useJobAccordions((state) => state.isOverviewOpen);
  const setIsOverviewOpen = useJobAccordions(
    (state) => state.setIsOverviewOpen
  );
  return [isOverviewOpen, setIsOverviewOpen] as const;
};

export const useJobParametersAccordion = () => {
  const isParametersOpen = useJobAccordions((state) => state.isParametersOpen);
  const setIsParametersOpen = useJobAccordions(
    (state) => state.setIsParametersOpen
  );
  return [isParametersOpen, setIsParametersOpen] as const;
};

export const useJobEnvVarsAccordion = () => {
  const isEnvVarsOpen = useJobAccordions((state) => state.isEnvVarsOpen);
  const setIsEnvVarsOpen = useJobAccordions((state) => state.setIsEnvVarsOpen);
  return [isEnvVarsOpen, setIsEnvVarsOpen] as const;
};

export const JobAccordion = (props: AccordionProps) => {
  const { reset } = useJobAccordions();
  React.useEffect(() => {
    return () => reset();
  }, [reset]);

  return <Accordion {...props} />;
};
