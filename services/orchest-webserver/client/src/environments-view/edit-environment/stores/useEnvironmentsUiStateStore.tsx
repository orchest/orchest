import create from "zustand";

type EnvironmentsUiState = {
  isPropertiesOpen: boolean;
  isSetupScriptOpen: boolean;
  isLogsOpen: boolean;
  setIsPropertiesOpen: (value: boolean) => void;
  setIsSetupScriptOpen: (value: boolean) => void;
  setIsLogsOpen: (value: boolean) => void;
  reset: () => void;
};

export const useEnvironmentsUiStateStore = create<EnvironmentsUiState>(
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
