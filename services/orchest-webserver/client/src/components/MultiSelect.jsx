// @ts-check
import * as React from "react";
import { useId, Box, IconButton, IconCrossSolid } from "@orchest/design-system";

/**
 * @typedef {{value: string}} TMultiSelectItem
 * @typedef {React.KeyboardEvent<HTMLInputElement>
 *  & { target: HTMLInputElement }
 * } TMultiSelectInputEvent
 *
 * @param {Object} props
 * @param {string} props.label
 * @param {boolean} [props.screenReaderOnlyLabel]
 * @param {TMultiSelectItem[]} props.items
 * @param {(items) => void} [props.onChange]
 */
export const MultiSelect = ({
  label,
  screenReaderOnlyLabel,
  items: initialSelectedItems = [],
  onChange,
}) => {
  const id = {
    label: useId(),
    input: useId(),
  };

  const [inputValue, setInputValue] = React.useState("");
  const [error, setError] = React.useState(null);

  const [selectedItems, setSelectedItems] = React.useState(
    initialSelectedItems
  );

  /** @param {string} value */
  const isValueWhitespace = (value) => !value.replace(/\s/g, "").length;

  /** @param {TMultiSelectItem} item */
  const removeItem = (item) => {
    console.log("handle remove");
    setSelectedItems((prevState) =>
      prevState.filter((prevStateItem) => prevStateItem !== item)
    );
  };

  /** @param {TMultiSelectInputEvent} event */
  const handleChange = (event) => {
    // clear any previous errors
    setError();

    const value = event?.target?.value;

    if (isValueWhitespace(value)) {
      setInputValue("");
      return;
    }

    if (selectedItems.some((selectedItem) => selectedItem.value === value)) {
      setError(`"${value}" already exists`);
    }

    setInputValue(value);
  };

  /** @param {TMultiSelectInputEvent} event */
  const handleKeyDown = (event) => {
    if (
      event.key === "Backspace" &&
      (!event.target?.value || event.target.value === "")
    ) {
      removeItem(selectedItems[selectedItems.length - 1]);
    }
  };

  /** @param {TMultiSelectInputEvent} event */
  const handleKeyUp = (event) => {
    const value = event.target?.value;

    if (!error && event.key === "Enter") {
      if (isValueWhitespace(value)) return;

      setSelectedItems((prevState) => [...prevState, { value }]);
      setInputValue("");
    }
  };

  React.useEffect(() => {
    if (onChange) onChange(selectedItems);
  }, [selectedItems]);

  return (
    <React.Fragment>
      <Box
        as="div"
        css={{
          $$padding: "$space$2",
          position: "relative",
          "&::after": {
            content: "''",
            position: "absolute",
            width: "100%",
            bottom: 0,
            borderBottom: "1px solid",
            borderBottomColor: error ? "$error" : "$gray500",
          },
          "&:focus-within::after": {
            borderBottomWidth: "2px",
            borderBottomColor: error ? "$error" : "$gray900",
          },
        }}
      >
        <Box
          as="label"
          id={id.label}
          htmlFor={id.input}
          css={screenReaderOnlyLabel && { include: "screenReaderOnly" }}
        >
          {label}
        </Box>

        <Box
          css={{
            $$gap: "$space$2",
            $$gapOuter: "calc(($$gap * -1) / 2)",
            $$gapInner: "calc($$gap / 2)",
            display: "flex",
            width: "100%",
            flexWrap: "wrap",
            alignItems: "center",
            justifyItems: "center",
            margin: "$$gapOuter",
            "> *": { margin: "$$gapInner" },
          }}
        >
          {selectedItems.map((selectedItem, index) => (
            <Box
              key={index}
              css={{
                display: "inline-flex",
                alignItems: "center",
                padding: "$1 $2",
                backgroundColor: "$gray200",
                borderRadius: "$rounded",
              }}
            >
              {selectedItem.value}
              <IconButton
                tabIndex={-1}
                type="button"
                size="4"
                label="Remove"
                onClick={() => {
                  removeItem(selectedItem);
                }}
                css={{
                  marginLeft: "$1",
                  borderRadius: "100%",
                  color: "$white",
                  backgroundColor: "$gray600",
                  padding: "calc($1 / 2)",
                  "&:hover": { backgroundColor: "$gray800" },
                  "> svg": {
                    $$iconSize: "$space$3",
                  },
                }}
              >
                <IconCrossSolid />
              </IconButton>
            </Box>
          ))}
          <Box
            as="input"
            id={id.input}
            value={inputValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            css={{
              padding: "$$padding 0",
              flexGrow: 1,
              border: 0,
              borderRadius: 0,
              backgroundColor: "transparent",
              minWidth: "8ch",
            }}
          />
        </Box>
      </Box>
      <Box
        css={{
          marginTop: "$2",
          color: "$error",
          display: error ? "block" : "none",
        }}
      >
        {error}
      </Box>
    </React.Fragment>
  );
};
