import { Accordion } from "@/components/Accordion";
import { AccordionProps } from "@mui/material/Accordion";
import React from "react";
import create from "zustand";

type EnvironmentAccordions = {
  isPropertiesOpen: boolean;
  isSetupScriptOpen: boolean;
  isLogsOpen: boolean;
  setIsPropertiesOpen: (value: boolean) => void;
  setIsSetupScriptOpen: (value: boolean) => void;
  setIsLogsOpen: (value: boolean) => void;
  reset: () => void;
};

export const useEnvironmentAccordions = create<EnvironmentAccordions>(
  (set) => ({
    isPropertiesOpen: true,
    isSetupScriptOpen: true,
    isLogsOpen: true,
    setIsPropertiesOpen: (value) => set({ isPropertiesOpen: value }),
    setIsSetupScriptOpen: (value) => set({ isSetupScriptOpen: value }),
    setIsLogsOpen: (value) => set({ isLogsOpen: value }),
    reset: () =>
      set({
        isPropertiesOpen: true,
        isSetupScriptOpen: true,
        isLogsOpen: true,
      }),
  })
);

export const EnvironmentAccordion = (props: AccordionProps) => {
  const { reset } = useEnvironmentAccordions();
  React.useEffect(() => {
    return () => reset();
  }, [reset]);

  return <Accordion {...props} />;
};
