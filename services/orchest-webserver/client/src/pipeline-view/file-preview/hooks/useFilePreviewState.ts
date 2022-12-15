import create from "zustand";
import { persist } from "zustand/middleware";

type FilePreviewState = {
  showConnections: boolean;
  setShowConnections: (value: boolean) => void;
};

export const useFilePreviewState = create(
  persist<FilePreviewState>(
    (set) => {
      return {
        showConnections: true,
        setShowConnections: (value) => set({ showConnections: value }),
      };
    },
    { name: "orchest.filePreviewState" }
  )
);
