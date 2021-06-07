import type * as Polymorphic from "@radix-ui/react-polymorphic";
import { config, styled } from "../core";
import type { CSS, ExtractVariants, ICSSProp } from "../types";

const DEFAULT_TAG = "p";

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

export type TTextVariants = ExtractVariants<typeof Text>;
export interface ITextProps extends ICSSProp, ExtractVariants<typeof Text> {}
export type TTextComponent = Polymorphic.ForwardRefComponent<
  typeof DEFAULT_TAG,
  ITextProps
>;

export const Text = styled(DEFAULT_TAG, {
  fontWeight: "$normal",
  variants: {
    size,
  },
  defaultVariants: {
    size: "base",
  },
});
