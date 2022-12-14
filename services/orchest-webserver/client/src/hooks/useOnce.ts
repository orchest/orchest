import React from "react";

export const useOnce = (condition: boolean, callback?: () => void) => {
  const ran = React.useRef(false);
  const didRun = ran.current;

  React.useEffect(() => {
    if (didRun) return;
    else if (condition) {
      callback?.();
      ran.current = true;
    }
  }, [callback, didRun, condition]);

  return didRun;
};
