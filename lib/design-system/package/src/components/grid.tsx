import { config, styled } from "../core";
import type { CSS, ExtractVariants } from "../types";

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
