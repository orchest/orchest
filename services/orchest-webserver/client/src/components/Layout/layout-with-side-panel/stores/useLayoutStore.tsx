import { clamp } from "@/utils/math";
import create from "zustand";
import { persist } from "zustand/middleware";

type LayoutStateAction = number | ((prevValue: number) => number);

const getValue = (currentValue: number, value: LayoutStateAction) =>
  value instanceof Function ? value(currentValue) : value;

export type LayoutState = {
  mainSidePanelWidth: number;
  setMainSidePanelWidth: (value: LayoutStateAction) => void;
  secondarySidePanelWidth: number;
  setSecondarySidePanelWidth: (value: LayoutStateAction) => void;
};

const DEFAULT_MAIN_SIDE_PANEL_WIDTH = 300;
export const MIN_MAIN_SIDE_PANEL_WIDTH = 256;
const DEFAULT_SECONDARY_SIDE_PANEL_WIDTH = 450;
export const MIN_SECONDARY_SIDE_PANEL_WIDTH = 420;
export const MAX_WIDTH = window.innerWidth / 2;

export const useLayoutStore = create(
  persist<LayoutState>(
    (set, get) => ({
      mainSidePanelWidth: DEFAULT_MAIN_SIDE_PANEL_WIDTH,
      setMainSidePanelWidth: (value) => {
        set({
          mainSidePanelWidth: clamp(
            getValue(get().mainSidePanelWidth, value),
            MIN_MAIN_SIDE_PANEL_WIDTH,
            MAX_WIDTH
          ),
        });
      },
      secondarySidePanelWidth: DEFAULT_SECONDARY_SIDE_PANEL_WIDTH,
      setSecondarySidePanelWidth: (value) => {
        set({
          secondarySidePanelWidth: clamp(
            getValue(get().secondarySidePanelWidth, value),
            MIN_SECONDARY_SIDE_PANEL_WIDTH,
            MAX_WIDTH
          ),
        });
      },
    }),
    { name: "orchest.layout" }
  )
);

const selectMainSidePanelWidth = (state: LayoutState) =>
  [state.mainSidePanelWidth, state.setMainSidePanelWidth] as const;
export const useMainSidePanelWidth = () => {
  const states = useLayoutStore(selectMainSidePanelWidth);
  return states;
};

const selectSecondarySidePanelWidth = (state: LayoutState) =>
  [state.secondarySidePanelWidth, state.setSecondarySidePanelWidth] as const;
export const useSecondarySidePanelWidth = () => {
  const states = useLayoutStore(selectSecondarySidePanelWidth);
  return states;
};
