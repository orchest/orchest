import React from "react";

export const useFirstRender = (callback?: () => void) => {
  const ref = React.useRef(true);
  const isFirstRender = ref.current;

  React.useEffect(() => {
    if (isFirstRender) callback?.();
  }, [isFirstRender, callback]);

  ref.current = false;

  return isFirstRender;
};
