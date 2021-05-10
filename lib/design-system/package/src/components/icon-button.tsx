import * as React from "react";
import { StitchesVariants } from "@stitches/react";
import type * as Polymorphic from "@radix-ui/react-polymorphic";
import { styled } from "../core";
import { ICSSProp } from "../types";

const svgSize = (size: string) => ({
  "> svg": {
    $$iconSize: size,
  },
});

const DEFAULT_ELEMENT = "button";

const StyledIconButton = styled(DEFAULT_ELEMENT, {
  apperance: "none",
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
    StitchesVariants<typeof StyledIconButton> {
  label: string;
}

type IconButtonComponent = Polymorphic.ForwardRefComponent<
  typeof DEFAULT_ELEMENT,
  IIconButtonProps
>;

export const IconButton = React.forwardRef(({ label, ...props }, ref) => {
  return (
    <StyledIconButton
      title={props.title || label}
      aria-label={label}
      {...props}
      ref={ref}
    />
  );
}) as IconButtonComponent;
