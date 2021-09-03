import { useEffect, useRef, useMemo } from "react";

const getKeyArr = (str: string) =>
  str.split(/\s*\+\s*/).filter((i) => i !== ""); // 'a +   b  +' => ['a', 'b']
const ctrlRegex = /(\bctrl|\bcontrol|\bmeta|\bcmd)(\s*\+\s*)?/;

const useHotKey = (
  nonMacHotkeys: [nonMacHotKey: string, callback: () => void][]
) => {
  const pressedKeysRef = useRef<Record<string, boolean>>({});
  const hotkeys = useMemo(() => {
    const normalizedHotKeys = nonMacHotkeys
      .filter(([str]) => ctrlRegex.test(str)) // all combination should have a ctrl or cmd
      .map(([nonMacHotkey, callback]): [string[], () => void] => {
        const keyArr = getKeyArr(nonMacHotkey.replace(ctrlRegex, ""));
        return [keyArr, callback];
      });

    return normalizedHotKeys;
  }, [nonMacHotkeys]);

  const keydownCallbackRef = useRef((event: KeyboardEvent) => {
    // to prevent key events during IME composition https://developer.mozilla.org/en-US/docs/Web/API/Document/keyup_event
    if (event.isComposing || event.keyCode === 229) return;

    const key = event.key.toLowerCase();

    //TODO: provide toggle functions for the hook consumer to call
    // for example, only turn on hotkeys when user is focusing on the canvas
    if ((event.ctrlKey || event.metaKey) && (key === "a" || key === "enter")) {
      event.preventDefault();
    }

    if ((key.length === 1 || key === "enter") && !pressedKeysRef.current[key])
      pressedKeysRef.current[key] = true;

    for (let i = 0; i < hotkeys.length; i++) {
      const [combination, callback] = hotkeys[i];
      const shouldFire =
        (event.ctrlKey || event.metaKey) &&
        !combination.some((k) => !pressedKeysRef.current[k]);

      if (shouldFire) {
        callback();
        break;
      }
    }
  });

  const keyupCallbackRef = useRef((event: KeyboardEvent) => {
    // to prevent key events during IME composition https://developer.mozilla.org/en-US/docs/Web/API/Document/keyup_event
    if (event.isComposing || event.keyCode === 229) return;

    const key = event.key.toLowerCase();
    // NOTE: while user is holding meta key, keyup for other keys does not fire
    // as a workaround, we clean up all pressedKeys when ctrl/meta is released
    if (pressedKeysRef.current[key]) delete pressedKeysRef.current[key];
    if (event.ctrlKey || event.metaKey) pressedKeysRef.current = {};
  });

  useEffect(() => {
    document.addEventListener("keydown", keydownCallbackRef.current);
    document.addEventListener("keyup", keyupCallbackRef.current);
  }, [hotkeys]);

  return () => {
    document.removeEventListener("keydown", keydownCallbackRef.current);
    document.removeEventListener("keyup", keyupCallbackRef.current);
  };
};

export { useHotKey };
