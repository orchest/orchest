// @ts-check
import * as React from "react";
import { Box, IconButton, IconCrossSolid } from "@orchest/design-system";
import Downshift from "downshift";

/**
 * @typedef {{value: string}} TMultiSelectItem
 *
 * @param {Object} props
 * @param {string} props.label
 * @param {boolean} [props.screenReaderOnlyLabel]
 * @param {TMultiSelectItem[]} props.items
 * @param {(items) => TMultiSelectItem[]} [props.onChange]
 */
export const MultiSelect = ({
  label,
  screenReaderOnlyLabel,
  items = [],
  onChange,
}) => (
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
          borderBottom: "1px solid $gray500",
        },
        "&:focus-within::after": {
          borderBottomWidth: "2px",
          borderBottomColor: "$gray900",
        },
      }}
    >
      <Box
        as="label"
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
        {items.map(
          (item) =>
            item && (
              <Box
                css={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "$1 $2",
                  backgroundColor: "$gray200",
                  borderRadius: "$rounded",
                }}
              >
                {item.value}
                <IconButton
                  size="4"
                  label="Remove"
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
            )
        )}
        <Box
          as="input"
          css={{
            padding: "$$padding 0",
            flexGrow: 1,
            border: 0,
            borderRadius: 0,
            backgroundColor: "transparent",
            minWidth: "8ch",
          }}
        ></Box>
      </Box>
    </Box>
  </React.Fragment>
);
