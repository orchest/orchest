import Chip from "@mui/material/Chip";
import { Box, styled, useId } from "@orchest/design-system";
import React from "react";

const isValueWhitespace = (value: string) => !value.replace(/\s/g, "").length;
const isNumeric = (value: string) => value.match("^\\d+$") != null;

type TMultiSelectInputRef = HTMLInputElement;
type TMultiSelectInputEvent = React.KeyboardEvent<TMultiSelectInputRef> & {
  target: TMultiSelectInputRef;
};
type TMultiSelectInputValue = string;
interface IMultiSelectInputProps
  extends Record<
    "onChange" | "onKeyDown" | "onKeyUp",
    (event: TMultiSelectInputEvent) => void
  > {
  "aria-labelledby"?: string;
  "aria-invalid"?: boolean;
  id: string;
  required?: boolean;
  disabled?: boolean;
  type?: "text" | "number";
  value: TMultiSelectInputValue;
  onBlur?: (event: any) => void;
}

interface IMultiSelectItem {
  value: string;
}
type TMultiSelectItems = IMultiSelectItem[];
type TMultiSelectContext = {
  getErrorProps: () => { id: string; "aria-live"?: any };
  getInputProps: () => IMultiSelectInputProps;
  getLabelProps: () => Record<"id" | "htmlFor", string>;
  inputValue: TMultiSelectInputValue;
  setInputValue: React.Dispatch<TMultiSelectInputValue>;
  items: TMultiSelectItems;
  setItems: React.Dispatch<TMultiSelectItems>;
  error?: string;
  setError?: React.Dispatch<string>;
  removeItem: (item: IMultiSelectItem) => void;
} & Pick<IMultiSelectInputProps, "required" | "type">;

export type TMultiSelectProps = {
  onChange: (items: TMultiSelectItems) => void;
  disabled?: boolean;
} & Pick<TMultiSelectContext, "items" | "required" | "type">;

const MultiSelectContext = React.createContext<TMultiSelectContext>(
  {} as TMultiSelectContext
);

const useMultiSelect = () => React.useContext(MultiSelectContext);

export const MultiSelect: React.FC<TMultiSelectProps> = ({
  children,
  items: initialItems = [],
  onChange,
  required,
  type = "text",
  disabled = false,
  ...props
}) => {
  const [error, setError] = React.useState<string | undefined>();
  const [inputValue, setInputValue] = React.useState("");
  const [items, setItems] = React.useState(initialItems);

  const errorId = useId();
  const labelId = useId();
  const inputId = useId();

  const hasChanged = React.useRef(false);

  React.useEffect(() => {
    if (!hasChanged.current && initialItems !== items)
      hasChanged.current = true;
  }, [initialItems, items]);

  React.useEffect(() => {
    if (hasChanged.current && onChange) onChange(items);
  }, [items]);

  const removeItem: TMultiSelectContext["removeItem"] = (item) => {
    setItems((prevState) =>
      prevState.filter((prevStateItem) => prevStateItem !== item)
    );
  };

  const getErrorProps: TMultiSelectContext["getErrorProps"] = () => ({
    id: errorId,
    "aria-live": "polite",
  });

  const getLabelProps: TMultiSelectContext["getLabelProps"] = () => ({
    id: labelId,
    htmlFor: inputId,
  });

  const addItem = (value) => {
    setItems((prevState) => [...prevState, value]);
    setInputValue("");
  };

  const checkErrors = (value: string) => {
    setError(undefined);

    if (type === "number" && !isNumeric(value)) {
      setError(`"${value}" is invalid. Please enter a number.`);
    }

    if (items.some((selectedItem) => selectedItem.value === value)) {
      setError(`"${value}" already exists`);
    }
  };

  const getInputProps: TMultiSelectContext["getInputProps"] = () => ({
    id: inputId,
    value: inputValue,
    required,
    disabled: disabled,
    type: "text",
    ...(type === "number" && { inputMode: "numeric", pattern: "[0-9]*" }),
    onBlur: (e) => {
      const value = e.target.value;

      if (isValueWhitespace(value)) {
        setInputValue("");
        return;
      }

      checkErrors(value);
      if (!error) {
        addItem({ value });
      }
    },
    onChange: (event) => {
      // clear any previous errors
      const value = event?.target?.value;

      if (isValueWhitespace(value)) {
        setInputValue("");
        return;
      }

      checkErrors(value);
      setInputValue(value);
    },
    onKeyDown: (event) => {
      if (
        event.key === "Backspace" &&
        (!event.target?.value || event.target.value === "")
      ) {
        removeItem(items[items.length - 1]);
      }
    },
    onKeyUp: (event) => {
      const value = event.target?.value;

      if (!error && event.key === "Enter") {
        if (isValueWhitespace(value)) return;
        addItem({ value });
      }
    },
    ...(error && { "aria-invalid": true, "aria-labelledby": errorId }),
  });

  return (
    <MultiSelectContext.Provider
      value={{
        error,
        setError,
        getErrorProps,
        getInputProps,
        getLabelProps,
        inputValue,
        setInputValue,
        items,
        setItems,
        removeItem,
        type,
        ...props,
      }}
    >
      <Box css={{ position: "relative" }}>{children}</Box>
    </MultiSelectContext.Provider>
  );
};

export const MultiSelectLabel: React.FC<{ screenReaderOnly?: boolean }> = ({
  children,
  screenReaderOnly,
}) => {
  const { getLabelProps } = useMultiSelect();

  return (
    <Box
      as="label"
      {...getLabelProps()}
      css={screenReaderOnly ? { include: "screenReaderOnly" } : {}}
    >
      {children}
    </Box>
  );
};

const MultiSelectInputContainer = styled("div", {
  $$borderWidth: "1px",
  include: "box",
  position: "relative",
  padding: "$2 0",
  "&::after": {
    content: "''",
    position: "absolute",
    width: "100%",
    left: 0,
    bottom: 0,
    borderBottom: "$$borderWidth solid $$borderColor",
  },
  "&:focus-within": {
    $$borderWidth: "2px",
  },
  variants: {
    hasError: {
      false: {
        $$borderColor: "$colors$gray600",
        "&:focus-within": {
          $$borderColor: "$colors$gray900",
        },
      },
      true: {
        $$borderColor: "$colors$error",
      },
    },
  },
});

const MultiSelectInputList = styled("ul", {
  $$gap: "$space$2",
  $$gapOuter: "calc(($$gap * -1) / 2)",
  $$gapInner: "calc($$gap / 2)",
  include: "box",
  display: "flex",
  width: "100%",
  flexWrap: "wrap",
  alignItems: "center",
  justifyItems: "center",
  margin: "$$gapOuter",
  "> li": { margin: "$$gapInner", "&:last-child": { flexGrow: 1 } },
});

const MultiSelectInputElement = styled("input", {
  include: "box",
  display: "block",
  width: "100%",
  padding: "$1 0",
  border: 0,
  borderRadius: 0,
  backgroundColor: "transparent",
  minWidth: "8ch",
});

export const MultiSelectInput: React.FC = () => {
  const { error, getInputProps, items, removeItem } = useMultiSelect();

  const inputProps = getInputProps();

  return (
    <MultiSelectInputContainer hasError={error ? true : false}>
      <MultiSelectInputList role="list">
        {items.map((selectedItem, index) => (
          <Chip
            key={index}
            label={selectedItem.value}
            onDelete={() => {
              if (!inputProps.disabled) {
                removeItem(selectedItem);
              }
            }}
            sx={{ marginRight: (theme) => theme.spacing(0.5) }}
          />
        ))}
        <li>
          <MultiSelectInputElement type="text" {...inputProps} />
        </li>
      </MultiSelectInputList>
    </MultiSelectInputContainer>
  );
};

const MultiSelectErrorText = styled("div", {
  include: "box",
  marginTop: "$2",
  color: "$error",
  variants: {
    isVisible: { false: { display: "none" }, true: { display: "block" } },
  },
});

export const MultiSelectError = () => {
  const { error, getErrorProps } = useMultiSelect();

  return (
    <MultiSelectErrorText {...getErrorProps()} isVisible={error ? true : false}>
      {error}
    </MultiSelectErrorText>
  );
};
