import React from "react";

export const useDebounce = <T,>(
  value: T,
  delay: number,
  callback?: (newValue: T) => void
) => {
  const [debouncedValue, setDebouncedValue] = React.useState(value);
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
      if (callback) callback(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
};
