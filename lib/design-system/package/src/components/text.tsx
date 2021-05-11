import { config, styled } from "../core";
import type { CSS } from "../types";

const { fontSizes } = config.theme;
type TFontSizes = keyof typeof fontSizes;

const size = Object.keys(fontSizes).reduce(
  (acc, cv) => ({
    ...acc,
    [cv]: {
      fontSize: `$fontSizes$${cv}`,
      lineHeight: `$lineHeights$${cv}`,
    },
  }),
  {}
) as { [key in TFontSizes]: CSS };

export const Text = styled("p", {
  fontWeight: "$normal",
  variants: {
    size,
  },
  defaultVariants: {
    size: "base",
  },
});
