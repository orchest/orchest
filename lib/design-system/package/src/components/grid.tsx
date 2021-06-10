import type * as Polymorphic from "@radix-ui/react-polymorphic";
import { config, styled } from "../core";
import type { CSS, ExtractVariants, ICSSProp } from "../types";

const DEFAULT_TAG = "div";

const columns = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const getColumns = columns.reduce(
  (acc, cv) => ({ ...acc, [`${cv}`]: { $$columns: cv } }),
  {}
) as { [key in typeof columns[number]]: CSS };

const getGaps = (property: "columnGap" | "gap" | "rowGap") =>
  Object.keys(config.theme.space).reduce(
    (acc, cv) => ({ ...acc, [`${cv}`]: { [property]: `$space$${cv}` } }),
    {}
  ) as { [key in keyof typeof config.theme.space]: CSS };

export type TGridVariants = ExtractVariants<typeof Grid>;
export interface IGridProps extends ICSSProp, TGridVariants {}
export type TGridComponent = Polymorphic.ForwardRefComponent<
  typeof DEFAULT_TAG,
  IGridProps
>;

export const Grid = styled("div", {
  include: "box",
  display: "grid",
  gridTemplateColumns: "repeat($$columns, minmax(0, 1fr))",
  variants: {
    columns: getColumns,
    gap: getGaps("gap"),
    columnGap: getGaps("columnGap"),
    rowGap: getGaps("rowGap"),
  },
  defaultVariants: {
    columns: "1",
    gap: 4,
  },
});
