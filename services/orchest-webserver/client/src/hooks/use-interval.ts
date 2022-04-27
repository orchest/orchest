import { hasValue } from "@orchest/lib-utils";
import * as React from "react";

export const useInterval = (
  callback: () => void,
  delay: number | null | undefined
) => {
  const savedCallback = React.useRef(callback);

  React.useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  React.useEffect(() => {
    if (!hasValue(delay)) return;

    const id = setInterval(() => savedCallback.current(), delay);

    return () => clearInterval(id);
  }, [delay]);
};
