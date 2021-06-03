import * as React from "react";
import type * as Polymorphic from "@radix-ui/react-polymorphic";
import { config, styled } from "../core";
import type { CSS, ExtractVariants, ICSSProp } from "../types";

const DEFAULT_TAG = "div";

const gap = Object.keys(config.theme.space).reduce(
  (acc, cv) => ({ ...acc, [cv]: { $$gap: `$space$${cv}` } }),
  {}
) as { [key in keyof typeof config.theme.space]: CSS };

const DIRECTIONS = [
  "column",
  "column-reverse",
  "row",
  "row-reverse",
  "inherit",
  "revert",
  "unset",
] as const;
const direction = DIRECTIONS.reduce(
  (acc, cv) => ({
    ...acc,
    [cv]: {
      flexDirection: cv,
      ...((cv.includes("row") || cv.includes("column")) && {
        "> * + *": {
          [cv.includes("row") ? "marginLeft" : "marginTop"]: "$$gap",
        },
      }),
    },
  }),
  {}
) as { [key in typeof DIRECTIONS[number]]: CSS };

const FlexRoot = styled(DEFAULT_TAG, {
  include: "box",
  display: "flex",
  listStyleType: "none",
  variants: { direction, gap },
});

export interface IFlexProps
  extends ICSSProp,
    ExtractVariants<typeof FlexRoot> {}

export type TFlexComponent = Polymorphic.ForwardRefComponent<
  typeof DEFAULT_TAG,
  IFlexProps
>;

export const Flex = React.forwardRef((props, forwardedRef) => (
  <FlexRoot
    ref={forwardedRef}
    role={["ul", "ol"].includes(props.as) ? "list" : undefined}
    {...props}
  />
)) as TFlexComponent;
