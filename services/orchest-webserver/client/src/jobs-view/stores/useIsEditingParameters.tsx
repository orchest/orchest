import create from "zustand";

export type UseIsEditingParameters = {
  isEditingParameters: boolean;
  setIsEditingParameters: (value: boolean) => void;
};

export const useIsEditingParameters = create<UseIsEditingParameters>((set) => ({
  isEditingParameters: false,
  setIsEditingParameters: (value) => set({ isEditingParameters: value }),
}));
