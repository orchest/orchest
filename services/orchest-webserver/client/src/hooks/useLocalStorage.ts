import React from "react";

function parseLocalStorageString<T>(
  itemAsString: string | null,
  defaultValue: T
): T {
  try {
    // never saved before
    if (itemAsString === null) return defaultValue;
    // it was saved before as undefined, so we take the saved value
    if (itemAsString === "undefined") return defaultValue;
    return JSON.parse(itemAsString) as T;
  } catch (error) {
    console.log(error);
    return defaultValue;
  }
}

/**
 * useLocalStorage reads and writes to localstorage
 */
export const useLocalStorage = <T>(
  key: string | undefined,
  defaultValue: T
) => {
  const privateKey = key ? `orchest.${key}` : undefined;

  const cachedItemString = React.useRef<string | null>();
  const [storedValue, setStoredValue] = React.useState<T>(() => {
    const item = privateKey ? window.localStorage.getItem(privateKey) : null;
    cachedItemString.current = item;
    return parseLocalStorageString<T>(item, defaultValue);
  });

  const setValue = React.useCallback(
    (value: T | ((value: T) => T)) => {
      try {
        setStoredValue((current) => {
          const valueToStore =
            value instanceof Function ? value(current) : value;
          cachedItemString.current = JSON.stringify(valueToStore);
          if (privateKey)
            window.localStorage.setItem(privateKey, cachedItemString.current);

          return valueToStore;
        });
      } catch (error) {
        console.log(error);
      }
    },
    [privateKey]
  );

  /**
   * Save value to localstorage without triggering a re-render.
   */
  const saveToLocalstorage = React.useCallback(
    (value: T | ((value: T) => T)) => {
      try {
        const valueToSave =
          value instanceof Function ? value(storedValue) : value;
        cachedItemString.current = JSON.stringify(valueToSave);
        if (privateKey)
          window.localStorage.setItem(privateKey, cachedItemString.current);
      } catch (error) {
        console.log(error);
      }
    },
    [storedValue, privateKey]
  );

  // stay sync when the value is updated by other tabs
  React.useEffect(() => {
    const onStorage = (e: StorageEvent): void => {
      if (
        e.storageArea === localStorage &&
        e.key === privateKey &&
        e.newValue !== cachedItemString.current
      ) {
        cachedItemString.current = e.newValue;
        setStoredValue(parseLocalStorageString(e.newValue, defaultValue));
      }
    };

    window.addEventListener("storage", onStorage);

    return () => window.removeEventListener("storage", onStorage);
  }, [privateKey, defaultValue]);

  return [storedValue, setValue, saveToLocalstorage] as const;
};
