import React from "react";

export const useEscapeToBlur = () => {
  React.useEffect(() => {
    const callback = (event: KeyboardEvent) => {
      if (event.code === "Escape") {
        const element = document.activeElement as HTMLElement | undefined;
        element?.blur?.();
      }
    };
    window.addEventListener("keydown", callback);
    return () => window.removeEventListener("keydown", callback);
  }, []);
};
