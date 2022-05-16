import React from "react";

type LocalStorageValue<T> = T | null | undefined;

function parseLocalStorageString<T>(
  itemAsString: string | null,
  defaultValue?: T
): T | null | undefined {
  try {
    // never saved before
    if (itemAsString === null && defaultValue !== undefined)
      return defaultValue;
    // it was saved before as undefined, so we take the saved value
    if (itemAsString === "undefined") return undefined;
    return itemAsString === null ? null : JSON.parse(itemAsString);
  } catch (error) {
    console.log(error);
    return defaultValue;
  }
}

export const useLocalStorage = <T>(key: string, defaultValue: T) => {
  const privateKey = `orchest.${key}`;

  const cachedItemString = React.useRef<string | null>();
  const [storedValue, setStoredValue] = React.useState<LocalStorageValue<T>>(
    () => {
      const item = window.localStorage.getItem(privateKey);
      cachedItemString.current = item;
      return parseLocalStorageString<T>(item, defaultValue);
    }
  );

  const setValue = React.useCallback(
    (
      value:
        | LocalStorageValue<T>
        | ((value: LocalStorageValue<T>) => LocalStorageValue<T>)
    ) => {
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
        setStoredValue(parseLocalStorageString(e.newValue));
      }
    };

    window.addEventListener("storage", onStorage);

    return () => window.removeEventListener("storage", onStorage);
  }, [privateKey]);

  return [storedValue, setValue] as const;
};
