import React from "react";

type StringPredicate = (value: string) => boolean;

export const useTextField = (predicate: StringPredicate = () => true) => {
  const [isDirty, setIsInputDirty] = React.useState(false);
  const [value, setValue] = React.useState("");
  const [isInitialized, setIsInitialized] = React.useState(false);

  const initValue = React.useCallback(
    (initialValue: string) => {
      if (isInitialized) return;
      setValue(initialValue);
      setIsInitialized(true);
    },
    [isInitialized]
  );

  const setAsDirtyOnBlur = React.useCallback(
    (
      onBlur?: (
        event: React.FocusEvent<HTMLTextAreaElement | HTMLInputElement>
      ) => void
    ) => (event: React.FocusEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      setIsInputDirty(true);
      setValue((value) => value.trim());
      onBlur?.(event);
    },
    []
  );

  const predicateRef = React.useRef(predicate);

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      setValue(e.target.value);
    },
    []
  );

  React.useLayoutEffect(() => {
    predicateRef.current = predicate;
  }, [predicate]);

  const isValid = React.useMemo(() => predicateRef.current(value), [value]);

  return {
    value,
    setValue,
    handleChange,
    setAsDirtyOnBlur,
    isDirty,
    isValid,
    /** Initialize the value */
    initValue,
    /** Tell if the value was ever initialized via `initValue`. */
    isInitialized,
  };
};
