import { useEffect, useCallback } from "react";
import hotkeys from "hotkeys-js";

const useHotKey = (keys: string, scope = "all", callback: () => void) => {
  useEffect(() => {
    hotkeys(keys, scope, function (event) {
      event.preventDefault();
      callback();
    });
  }, [keys]); // eslint-disable-line react-hooks/exhaustive-deps

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
