import hotkeys from "hotkeys-js";
import { useCallback, useRef } from "react";

// Also activate hotkeys on INPUT, SELECT, TEXTAREA
// Those are disabled by default.
hotkeys.filter = function (event) {
  return true;
};

const useHotKey = (
  keys: string,
  scope = "all",
  _callback: (event?) => void
) => {
  const callbackRef = useRef<(event: KeyboardEvent) => void>();

  // hotkeys-js persists the callback function
  // so we need to unbind the previous callback to ensure that our callback is latest one
  // we use useRef to keep track of the old one in order to unbind it in the next render
  if (callbackRef.current) {
    hotkeys.unbind(keys, scope, callbackRef.current);
  }
  callbackRef.current = (event) => {
    event.preventDefault();
    _callback(event);
  };
  hotkeys(keys, scope, callbackRef.current);

  const enableHotKey = useCallback(
    () => {
      hotkeys.setScope(scope);
    },
    [keys] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const disableHotKey = useCallback(
    () => {
      hotkeys.setScope("all");
    },
    [keys] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return [enableHotKey, disableHotKey];
};

export { useHotKey };
