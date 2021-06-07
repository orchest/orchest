// @ts-check
import * as React from "react";
import {
  css,
  useId,
  Box,
  IconButton,
  IconCrossSolid,
} from "@orchest/design-system";

/** @param {string} value */
const isValueWhitespace = (value) => !value.replace(/\s/g, "").length;
/** @param {string} value */
const isNumeric = (value) => value.match("^\\d+$") != null;

/**
 * @typedef { React.KeyboardEvent<HTMLInputElement>
 *  & { target: HTMLInputElement }
 * } TMultiSelectInputEvent
 *
 * @typedef { string } TMultiSelectInputValue
 * @typedef {{
 *    "aria-labelledby"?: string;
 *    "aria-invalid"?: boolean;
 *    id: string;
 *    required?: boolean;
 *    type?: "text" | "number";
 *    value: TMultiSelectInputValue;
 *  } &
 *  Record<
 *    "onChange" | "onKeyDown" | "onKeyUp",
 *    (event: TMultiSelectInputEvent) => void
 *  >} TMultiSelectInputProps
 *
 * @typedef {{ value: string }} TMultiSelectItem
 * @typedef { TMultiSelectItem[] } TMultiSelectItems
 *
 * @typedef {{
 *    getErrorProps: () => { id: string; "aria-live"?: any; };
 *    getInputProps: () => TMultiSelectInputProps;
 *    getLabelProps: () => Record<"id" | "htmlFor", string>;
 *    inputValue: TMultiSelectInputValue;
 *    setInputValue: React.Dispatch<TMultiSelectInputValue>;
 *    items: TMultiSelectItems;
 *    setItems: React.Dispatch<TMultiSelectItems>;
 *    error?: string;
 *    setError?: React.Dispatch<string>;
 *    removeItem?: (item: TMultiSelectItem) => void;
 *   } & Pick<TMultiSelectInputProps, "required" | "type">
 * } TMultiSelectContext
 *
 * @typedef {{
 *  onChange: (items: TMultiSelectItems) => void;
 *  } & Pick<TMultiSelectContext, "items" | "required" | "type">
 * } TMultiSelectProps
 *
 * @type {React.Context<TMultiSelectContext>}
 */
const MultiSelectContext = React.createContext(null);

const useMultiSelect = () => React.useContext(MultiSelectContext);

/**
 * @type {React.FC<TMultiSelectProps>}
 */
export const MultiSelect = ({
  children,
  items: initialItems = [],
  onChange,
  required,
  type = "text",
  ...props
}) => {
  const [error, setError] = React.useState(null);
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

  /** @type {TMultiSelectContext['removeItem']} */
  const removeItem = (item) => {
    console.log("handle remove");
    setItems((prevState) =>
      prevState.filter((prevStateItem) => prevStateItem !== item)
    );
  };

  /** @type {TMultiSelectContext['getErrorProps']} */
  const getErrorProps = () => ({
    id: errorId,
    "aria-live": "polite",
  });

  /** @type {TMultiSelectContext['getLabelProps']} */
  const getLabelProps = () => ({
    id: labelId,
    htmlFor: inputId,
  });

  /** @type {TMultiSelectContext['getInputProps']} */
  const getInputProps = () => ({
    id: inputId,
    value: inputValue,
    required,
    type: "text",
    ...(type === "number" && { inputmode: "numeric", pattern: "[0-9]*" }),
    onChange: (event) => {
      // clear any previous errors
      setError();

      const value = event?.target?.value;

      if (isValueWhitespace(value)) {
        setInputValue("");
        return;
      }

      if (type === "number" && !isNumeric(value)) {
        setError(`"${value}" is invalid. Please enter a number.`);
      }

      if (items.some((selectedItem) => selectedItem.value === value)) {
        setError(`"${value}" already exists`);
      }

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

        setItems((prevState) => [...prevState, { value }]);
        setInputValue("");
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

/** @type {React.FC<{screenReaderOnly?: boolean}>} */
export const MultiSelectLabel = ({ children, screenReaderOnly }) => {
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

/** @type {React.FC<{}>} */
export const MultiSelectInput = () => {
  const { error, getInputProps, items, removeItem } = useMultiSelect();

  const [tabIndices, setTabIndices] = React.useState(
    Array(items.length).fill(-1)
  );

  /** @param {{ index: number; value: -1 | 0; }} props */
  const setTabIndex = ({ index, value }) =>
    setTabIndices(
      items.map((_, i) => (i === index ? value : value === 0 ? -1 : 0))
    );

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
              tabIndex={tabIndices[index]}
              type="button"
              size="4"
              label="Remove"
              onClick={() => {
                removeItem(selectedItem);
              }}
              css={{
                // extract to design system later - this isn't stable
                marginLeft: "$1",
                borderRadius: "100%",
                color: "$white",
                backgroundColor: "$gray600",
                padding: "calc($1 / 2)",
                "&:hover, &:focus": { backgroundColor: "$gray800" },
                "> svg": {
                  $$iconSize: "$space$3",
                },
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
            {...getInputProps()}
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
