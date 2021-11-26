import type * as Polymorphic from "@radix-ui/react-polymorphic";
import * as React from "react";
import { styled } from "../core";
import type { ExtractVariants, ICSSProp } from "../types";

const svgSize = (size: string) => ({
  "> svg": {
    $$iconSize: size,
  },
});

const StyledIconButton = styled("button", {
  appearance: "none",
  display: "inline-flex",
  borderWidth: 0,
  flexShrink: 0,
  padding: "$$padding",
  color: "$$color",
  variants: {
    color: {
      gray: {
        $$color: "$colors$gray900",
        $$backgroundColorSolid: "$colors$gray200",
        $$backgroundColorSolidHover: "$colors$gray300",
        $$backgroundColorGhostHover: "$colors$gray200",
      },
      multiply: {
        $$color: "currentColor",
        $$backgroundColorSolid: "$colors$gray200",
        $$backgroundColorSolidHover: "$colors$gray300",
        $$backgroundColorGhostHover: "$colors$gray200",
        mixBlendMode: "multiply",
      },
    },
    variant: {
      solid: {
        backgroundColor: "$$backgroundColorSolid",
        "&:hover": {
          backgroundColor: "$$backgroundColorSolidHover",
        },
      },
      ghost: {
        backgroundColor: "transparent",
        "&:hover": {
          backgroundColor: "$$backgroundColorGhostHover",
        },
      },
    },
    size: {
      "3": {
        ...svgSize("$space$3"),
        $$padding: "$space$1",
        borderRadius: "$sm",
      },
      "4": {
        ...svgSize("$space$4"),
        $$padding: "$space$1",
        borderRadius: "$sm",
      },
    },
    bleed: {
      bottom: {
        marginBottom: "-$$padding",
      },
      bottomRight: {
        marginRight: "-$$padding",
        marginBottom: "-$$padding",
      },
    },
    rounded: {
      true: {
        "&&": {
          borderRadius: "$rounded",
        },
      },
    },
  },
  defaultVariants: {
    color: "gray",
    size: "4",
    variant: "solid",
  },
});

export type IIconButtonVariants = ExtractVariants<typeof StyledIconButton>;
export interface IIconButtonProps extends ICSSProp, IIconButtonVariants {}
export type TIconButtonComponent = Polymorphic.ForwardRefComponent<
  "button",
  IIconButtonProps
>;

/* eslint-disable react/display-name */

export const IconButton = React.forwardRef((props, ref) => (
  <StyledIconButton
    ref={ref}
    title={props.title}
    aria-label={props.title}
    {...props}
  />
)) as TIconButtonComponent;

/* eslint-enable react/display-name */
