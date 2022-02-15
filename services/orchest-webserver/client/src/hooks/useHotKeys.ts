import hotkeys, { KeyHandler } from "hotkeys-js";
import React from "react";
import { useMounted } from "./useMounted";
// Also activate hotkeys on INPUT, SELECT, TEXTAREA
// Those are disabled by default.
hotkeys.filter = function () {
  return true;
};

type KeyActionPairs = { [key: string]: KeyHandler };
type HotKeyConfig<Scope extends string> = Partial<
  Record<Scope, KeyActionPairs>
>;

export function useHotKeys<Scope extends string>(
  config: HotKeyConfig<Scope | "all">,
  deps: React.DependencyList = [config],
  shouldBind?: boolean
) {
  // // determine if user is pressing Ctrl / Cmd, if so, UI should show hot key hints
  // const [isShowingHints, setIsShowingHints] = React.useState(false);
  // React.useEffect(() => {
  //   const handler = (event: KeyboardEvent) => {
  //     setIsShowingHints(event.metaKey || event.ctrlKey);
  //   };
  //   window.addEventListener("keydown", handler);
  //   window.addEventListener("keyup", handler);
  //   return () => {
  //     window.removeEventListener("keydown", handler);
  //     window.removeEventListener("keyup", handler);
  //   };
  // }, []);
  // when hotkeys registers the config, it creates an closure, so config is memoized
  // to re-bind the config, we apply useMemo to explicitly create a new config according to the deps
  const memoizedConfig = React.useMemo(() => {
    return config;
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  const unbindAll = React.useCallback(() => {
    Object.entries(memoizedConfig).forEach(([scope, keyActionPairs]) => {
      Object.keys(keyActionPairs).forEach((key) => {
        hotkeys.unbind(key, scope);
      });
    });
  }, [memoizedConfig]);

  const bindConfig = React.useCallback(() => {
    unbindAll();

    Object.entries(memoizedConfig).forEach(([scope, keyActionPairs]) => {
      Object.entries(keyActionPairs).forEach(([key, action]) => {
        if (scope === "all") {
          hotkeys(key, action);
        } else {
          hotkeys(key, scope, action);
        }
      });
    });
  }, [memoizedConfig, unbindAll]);

  const mounted = useMounted();

  React.useEffect(() => {
    // bind when mounted
    if (mounted.current) {
      bindConfig();
    }
    // unbind everything when unmounted
    return () => unbindAll();
  }, [bindConfig, unbindAll, mounted]);

  React.useEffect(() => {
    if (shouldBind === undefined || shouldBind) bindConfig();
    if (shouldBind === false) unbindAll();
  }, [shouldBind, bindConfig, unbindAll]);

  const setScope = React.useCallback(
    (scope: keyof typeof config) => hotkeys.setScope(scope.toString()),
    []
  );

  return {
    setScope,
    getScope: hotkeys.getScope,
    bindConfig,
    unbindAll,
    unbind: hotkeys.unbind,
    // isShowingHints,
  };
}
