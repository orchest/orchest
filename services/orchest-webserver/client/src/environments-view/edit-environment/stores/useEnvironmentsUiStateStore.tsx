import create from "zustand";

type EnvironmentsUiState = {
  isSetupScriptOpen: boolean;
  isLogsOpen: boolean;
  setIsSetupScriptOpen: (value: boolean) => void;
  setIsLogsOpen: (value: boolean) => void;
};

export const useEnvironmentsUiStateStore = create<EnvironmentsUiState>(
  (set) => ({
    isSetupScriptOpen: true,
    isLogsOpen: true,
    setIsSetupScriptOpen: (value) => set({ isSetupScriptOpen: value }),
    setIsLogsOpen: (value) => set({ isLogsOpen: value }),
  })
);
