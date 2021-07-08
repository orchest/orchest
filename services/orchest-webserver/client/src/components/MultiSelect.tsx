import * as React from "react";
import {
  css,
  useId,
  Box,
  IconButton,
  IconCrossSolid,
} from "@orchest/design-system";

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
  removeItem?: (item: IMultiSelectItem) => void;
} & Pick<IMultiSelectInputProps, "required" | "type">;

export type TMultiSelectProps = {
  onChange: (items: TMultiSelectItems) => void;
  disabled?: boolean;
} & Pick<TMultiSelectContext, "items" | "required" | "type">;

const MultiSelectContext = React.createContext<TMultiSelectContext>(null);

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
  const [error, setError] = React.useState<string>(null);
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

  const checkErrors = (value) => {
    setError(null);

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
      css={screenReaderOnly && { include: "screenReaderOnly" }}
    >
      {children}
    </Box>
  );
};

const multiSelectInputContainer = css({
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

const multiSelectInputList = css({
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

const multiSelectInputChip = css({
  include: "box",
  display: "inline-flex",
  alignItems: "center",
  padding: "$1 $2",
  backgroundColor: "$gray200",
  borderRadius: "$rounded",
});

const multiSelectInputElement = css({
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

  const [tabIndices, setTabIndices] = React.useState(
    Array(items.length).fill(-1)
  );

  const setTabIndex = ({ index, value }: { index: number; value: -1 | 0 }) =>
    setTabIndices(
      items.map((_, i) => (i === index ? value : value === 0 ? -1 : 0))
    );
  const inputProps = getInputProps();

  return (
    <div
      className={multiSelectInputContainer({ hasError: error ? true : false })}
    >
      <ul role="list" className={multiSelectInputList()}>
        {items.map((selectedItem, index) => (
          <li
            key={index}
            onClick={() => setTabIndex({ index, value: 0 })}
            onBlur={() => setTabIndex({ index, value: -1 })}
            className={multiSelectInputChip()}
          >
            {selectedItem.value}
            <IconButton
              color="multiply"
              size="3"
              rounded
              label="Remove"
              type="button"
              tabIndex={tabIndices[index]}
              onClick={() => {
                if (!inputProps.disabled) {
                  removeItem(selectedItem);
                }
              }}
              css={{
                marginLeft: "$1",
                color: "$white",
                opacity: inputProps.disabled ? 0.5 : 1,
                backgroundColor: "$gray600",
                padding: "calc($1 / 2)",
                "&:hover, &:focus": { backgroundColor: "$gray800" },
              }}
            >
              <IconCrossSolid />
            </IconButton>
          </li>
        ))}
        <li>
          <input
            type="text"
            className={multiSelectInputElement()}
            {...inputProps}
          />
        </li>
      </ul>
    </div>
  );
};

const multiSelectError = css({
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
    <div
      {...getErrorProps()}
      className={multiSelectError({ isVisible: error ? true : false })}
    >
      {error}
    </div>
  );
};
