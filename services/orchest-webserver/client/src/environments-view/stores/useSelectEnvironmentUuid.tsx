import create from "zustand";

type SelectEnvironmentUuidState = {
  environmentUuid?: string;
  setEnvironmentUuid: (environmentUuid: string) => void;
};

export const useSelectEnvironmentUuid = create<SelectEnvironmentUuidState>(
  (set) => ({
    setEnvironmentUuid: (environmentUuid) => set({ environmentUuid }),
  })
);
