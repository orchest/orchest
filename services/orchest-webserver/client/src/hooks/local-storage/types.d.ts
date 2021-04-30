export function useLocalStorage<T>(key: string, initialValue: T);
export function setValue<T>(value: T | ((val: T) => T));
