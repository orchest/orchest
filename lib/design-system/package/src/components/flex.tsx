import type * as Polymorphic from "@radix-ui/react-polymorphic";
import { config, styled } from "../core";
import type { CSS, ExtractVariants, ICSSProp } from "../types";

const DEFAULT_TAG = "div";
const CHILD_WITH_GAP = "> * + *";

const GAPS = config.theme.space;
const gap = Object.keys(GAPS).reduce(
  (acc, cv) => ({
    ...acc,
    [cv]: { [CHILD_WITH_GAP]: { $$flexGap: `$space$${cv}` } },
  }),
  {}
) as { [key in keyof typeof GAPS]: CSS };

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
        [CHILD_WITH_GAP]: {
          [cv.includes("row") ? "marginLeft" : "marginTop"]: "$$flexGap",
        },
      }),
    },
  }),
  {}
) as { [key in typeof DIRECTIONS[number]]: CSS };

export type TFlexVariants = ExtractVariants<typeof Flex>;
export interface IFlexProps extends ICSSProp, TFlexVariants {}
export type TFlexComponent = Polymorphic.ForwardRefComponent<
  typeof DEFAULT_TAG,
  IFlexProps
>;

export const Flex = styled(DEFAULT_TAG, {
  include: "box",
  display: "flex",
  listStyleType: "none",
  variants: {
    direction,
    gap,
  },
  defaultVariants: {
    direction: "row",
    gap: 0,
  },
});
