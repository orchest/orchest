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

export const usePropertiesAccordion = () => {
  const isPropertiesOpen = useEnvironmentAccordions(
    (state) => state.isPropertiesOpen
  );
  const setIsPropertiesOpen = useEnvironmentAccordions(
    (state) => state.setIsPropertiesOpen
  );
  return [isPropertiesOpen, setIsPropertiesOpen] as const;
};

export const useLogsAccordion = () => {
  const isLogsOpen = useEnvironmentAccordions((state) => state.isLogsOpen);
  const setIsLogsOpen = useEnvironmentAccordions(
    (state) => state.setIsLogsOpen
  );
  return [isLogsOpen, setIsLogsOpen] as const;
};

export const useSetupScriptAccordion = () => {
  const isSetupScriptOpen = useEnvironmentAccordions(
    (state) => state.isSetupScriptOpen
  );
  const setIsSetupScriptOpen = useEnvironmentAccordions(
    (state) => state.setIsSetupScriptOpen
  );
  return [isSetupScriptOpen, setIsSetupScriptOpen] as const;
};
