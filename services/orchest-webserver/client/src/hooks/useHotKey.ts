import hotkeys from "hotkeys-js";
import { useCallback, useRef, useState } from "react";

// Also activate hotkeys on INPUT, SELECT, TEXTAREA
// Those are disabled by default.
hotkeys.filter = function (event) {
  return true;
};

const ORCHEST_SCOPE = "orchest";

const useHotKey = (
  keys: string,
  _callback: (event?) => void,
  scope = ORCHEST_SCOPE
) => {
  const callbackRef = useRef<(event: KeyboardEvent) => void>();
  const [isDisabled, setIsDisabled] = useState(false);

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

  const _enableHotKey = (keys, scope, callbackRef) => {
    if (isDisabled) {
      setIsDisabled(false);
    }

    hotkeys.setScope(scope);
    hotkeys(keys, scope, callbackRef.current);
  };

  // By default the useHotKey hook will bind the callback
  // to the key
  if (!isDisabled) {
    _enableHotKey(keys, scope, callbackRef);
  }

  const enableHotKey = useCallback(
    () => {
      _enableHotKey(keys, scope, callbackRef);
    },
    [keys, scope, callbackRef.current] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const disableHotKey = useCallback(
    () => {
      setIsDisabled(true);
      if (callbackRef.current) {
        hotkeys.unbind(keys, scope, callbackRef.current);
      }
    },
    [keys, scope, callbackRef.current] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return [enableHotKey, disableHotKey];
};

export { useHotKey };
