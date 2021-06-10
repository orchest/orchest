import type * as Polymorphic from "@radix-ui/react-polymorphic";
import { styled } from "../core";
import type { ExtractVariants, ICSSProp } from "../types";

const DEFAULT_TAG = "a";

export type TLinkVariants = ExtractVariants<typeof Link>;
export interface ILinkProps extends ICSSProp, TLinkVariants {}
export type TLinkComponent = Polymorphic.ForwardRefComponent<
  typeof DEFAULT_TAG,
  ILinkProps
>;

export const Link = styled(DEFAULT_TAG, {
  variants: {
    variant: {
      inline: {
        appearance: "none",
        backgroundColor: "transparent",
        border: 0,
        padding: 0,
        flexShrink: 0,
        color: "$link",
        textAlign: "inherit",
        WebkitTapHighlightColor: "rgba(0,0,0,0)",
        textDecorationLine: "underline",
        textUnderlineOffset: "3px",
        textDecorationColor: "currentColor",
        cursor: "pointer",
        "&:hover": {
          color: "$linkHover",
        },
      },
    },
  },
  defaultVariants: {
    variant: "inline",
  },
});
