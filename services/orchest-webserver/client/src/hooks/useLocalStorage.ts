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
export const useLocalStorage = <T>(key: string, defaultValue: T) => {
  const privateKey = `orchest.${key}`;

  const cachedItemString = React.useRef<string | null>();
  const [storedValue, setStoredValue] = React.useState<T>(() => {
    const item = window.localStorage.getItem(privateKey);
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
          window.localStorage.setItem(privateKey, cachedItemString.current);
          return valueToStore;
        });
      } catch (error) {
        console.log(error);
      }
    },
    [privateKey]
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

  return [storedValue, setValue] as const;
};
