import type { CSS, VariantProps } from "@stitches/react";

export interface ICSSProp {
  css?: CSS;
}

export type ExtractVariants<T> = VariantProps<T>;
