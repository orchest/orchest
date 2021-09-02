import { useEffect, useRef, useMemo } from "react";

const isEqualWithoutOrder = (arr1: unknown[], arr2: unknown[]) => {
  if (arr1.length !== arr2.length) return false;
  return !arr1.some((i) => !arr2.includes(i));
};

const getKeyArr = (str: string) => str.split(/\s*\+\s*/); // 'a +   b' => ['a', 'b']

const getUniqueKeys = (keys: string[]) => {
  const registered: Record<string, number> = {};
  const uniqueKeys = [];
  keys.forEach((key) => {
    if (registered[key] === undefined) {
      uniqueKeys.push(key);
      registered[key] = uniqueKeys.length - 1;
    } else {
      // move the key to the last position
      // we don't need to update all registered key's index
      // because this function is called per keystroke
      // it could only have one duplicate, i.e. the last keystroke
      uniqueKeys.push(uniqueKeys.splice(registered[key], 1)[0]);
    }
  });
  return uniqueKeys;
};

const useHotKey = (
  nonMacHotKey: string,
  callback: (keyCombination: string) => void
) => {
  const pressedKeysRef = useRef<string[]>([]);

  const hotkey = useMemo(() => {
    const isMac = /(Mac)/i.test(window.navigator.userAgent);
    return isMac ? nonMacHotKey.replace("control", "meta") : nonMacHotKey; // switch to Cmd if user is on Mac
  }, [nonMacHotKey]);
  const maxKeyCombination = useMemo(() => getKeyArr(hotkey).length, [hotkey]);

  const keydownCallbackRef = useRef((event: KeyboardEvent) => {
    // NOTE: all native behaviors are banned!
    event.preventDefault();
    const key = event.key.toLowerCase();
    const keysArr = getUniqueKeys([...pressedKeysRef.current, key]);

    pressedKeysRef.current =
      keysArr.length > maxKeyCombination ? keysArr.slice(1) : keysArr;

    const combinationArr = getKeyArr(hotkey);
    const keysArrToCompare =
      keysArr.length > combinationArr.length
        ? keysArr.slice(-combinationArr.length)
        : keysArr;

    const shouldFire = isEqualWithoutOrder(keysArrToCompare, combinationArr);

    if (shouldFire) callback(pressedKeysRef.current.join("+"));
  });

  const keyupCallbackRef = useRef(() => {
    pressedKeysRef.current = [];
  });

  useEffect(() => {
    document.body.addEventListener("keydown", keydownCallbackRef.current);
    document.body.addEventListener("keyup", keyupCallbackRef.current);
  }, [hotkey]);

  return () => {
    document.body.removeEventListener("keydown", keydownCallbackRef.current);
    document.body.removeEventListener("keyup", keyupCallbackRef.current);
  };
};

export { useHotKey };
