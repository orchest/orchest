import * as React from "react";
import type * as Polymorphic from "@radix-ui/react-polymorphic";
import { styled } from "../core";
import type { ExtractVariants, ICSSProp } from "../types";

const svgSize = (size: string) => ({
  "> svg": {
    $$iconSize: size,
  },
});

const DEFAULT_TAG = "button";

const StyledIconButton = styled(DEFAULT_TAG, {
  appearance: "none",
  display: "inline-flex",
  borderWidth: 0,
  flexShrink: 0,
  padding: "$$padding",
  variants: {
    bleed: {
      bottom: {
        marginBottom: "-$$padding",
      },
      bottomRight: {
        marginRight: "-$$padding",
        marginBottom: "-$$padding",
      },
    },
    size: {
      "4": {
        ...svgSize("$space$4"),
        $$padding: "$space$1",
        borderRadius: "$sm",
      },
    },
    variant: {
      ghost: {
        color: "currentcolor",
        mixBlendMode: "multiply",
        backgroundColor: "transparent",
        "&:hover": {
          backgroundColor: "$gray200",
        },
      },
    },
  },
  defaultVariants: {
    size: "4",
  },
});

export interface IIconButtonProps
  extends ICSSProp,
    ExtractVariants<typeof StyledIconButton> {
  label: string;
}

export type TIconButtonComponent = Polymorphic.ForwardRefComponent<
  typeof DEFAULT_TAG,
  IIconButtonProps
>;

export const IconButton = React.forwardRef(({ label, ...props }, ref) => (
  <StyledIconButton
    ref={ref}
    title={props.title || label}
    aria-label={label}
    {...props}
  />
)) as TIconButtonComponent;
