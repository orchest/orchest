import type { StitchesCss, StitchesVariants } from "@stitches/react";

import { stitches } from "./core";

export type CSS = StitchesCss<typeof stitches>;

export interface ICSSProp {
  css?: CSS;
}

export type ExtractVariants<T> = StitchesVariants<T>;
