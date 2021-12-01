import hotkeys, { KeyHandler } from "hotkeys-js";
import React from "react";
// Also activate hotkeys on INPUT, SELECT, TEXTAREA
// Those are disabled by default.
hotkeys.filter = function (event) {
  return true;
};

type KeyActionPairs = { [key: string]: KeyHandler };
type HotKeyConfig<Scope extends string> = Record<Scope, KeyActionPairs>;

export function useHotKeys<Scope extends string>(
  config: HotKeyConfig<Scope | "all">,
  deps: React.DependencyList,
  shouldBind?: boolean
) {
  const unbindAll = () => {
    Object.entries(config).forEach(([scope, keyActionPairs]) => {
      Object.keys(keyActionPairs).forEach((key) => {
        hotkeys.unbind(key, scope);
      });
    });
  };

  const bindConfig = () => {
    unbindAll();

    Object.entries(config).forEach(([scope, keyActionPairs]) => {
      Object.entries(keyActionPairs).forEach(([key, action]) => {
        if (scope === "all") {
          hotkeys(key, action);
        } else {
          hotkeys(key, scope, action);
        }
      });
    });
  };

  React.useEffect(() => {
    // bind when mounted
    if (shouldBind === undefined || shouldBind) bindConfig();
    // unbind everything when unmounted
    return () => unbindAll();
  }, []);

  React.useEffect(() => {
    if (shouldBind === undefined || shouldBind) bindConfig();
    if (shouldBind === false) unbindAll();
  }, deps);

  const setScope = (scope: keyof typeof config) =>
    hotkeys.setScope(scope.toString());

  return {
    setScope,
    getScope: hotkeys.getScope,
    unbindAll,
    unbind: hotkeys.unbind,
  };
}
