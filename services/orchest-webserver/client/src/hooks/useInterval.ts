import React from "react";

export function useInterval(
  callback: () => void,
  delay: number | undefined | null
) {
  const callbackRef = React.useRef(callback);

  React.useLayoutEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  React.useEffect(() => {
    if (!delay && delay !== 0) return;

    const id = window.setInterval(() => callbackRef.current(), delay);

    return () => window.clearInterval(id);
  }, [delay]);
}
