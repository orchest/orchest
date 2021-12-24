import React from "react";

export const useMounted = (onUnmounted?: () => void) => {
  const mounted = React.useRef(false);

  React.useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (onUnmounted) onUnmounted();
    };
  }, []);

  return mounted.current;
};
