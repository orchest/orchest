// @ts-check
import React from "react";

/**
 *
 * @param {() => void} callback
 * @param {number | null} delay
 */
function useTimeout(callback, delay) {
  const savedCallback = React.useRef(callback);

  // Remember the latest callback if it changes.
  React.useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the timeout.
  React.useEffect(() => {
    // Don't schedule if no delay is specified.
    if (delay === null) {
      return;
    }

    const id = setTimeout(() => savedCallback.current(), delay);

    return () => clearTimeout(id);
  }, [delay]);
}

export default useTimeout;
