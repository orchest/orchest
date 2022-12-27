import React from "react";

type StringPredicate = (value: string) => boolean;

export const useTextField = (predicate: StringPredicate) => {
  const [isDirty, setIsInputDirty] = React.useState(false);
  const setAsDirtyOnBlur = React.useCallback(
    (
      onBlur?: (
        event: React.FocusEvent<HTMLTextAreaElement | HTMLInputElement>
      ) => void
    ) => (event: React.FocusEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      setIsInputDirty(true);
      onBlur?.(event);
    },
    []
  );

  const [value, setValue] = React.useState("");
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
    handleChange,
    setAsDirtyOnBlur,
    isDirty,
    isValid,
  };
};
