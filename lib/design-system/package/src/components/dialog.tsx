import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import type * as Polymorphic from "@radix-ui/react-polymorphic";
import { styled, keyframes } from "../core";
import { ExtractVariants, ICSSProp } from "../types";
import { Heading, THeadingComponent } from "./heading";

const animationSpeed = {
  in: "200ms",
  out: "120ms",
};
const fadeIn = keyframes({ from: { opacity: "0" }, to: { opacity: "1" } });
const fadeOut = keyframes({ from: { opacity: 1 }, to: { opacity: 0 } });
const fadeInZoom = keyframes({
  "0%": {
    transform: "scale(0.8) translate($$translate, $$translate)",
    opacity: "0",
  },
  "100%": {
    transform: "scale(1) translate($$translate, $$translate)",
    opacity: "1",
  },
});

export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

const DialogOverlay = styled(DialogPrimitive.Overlay, {
  include: "box",
  backgroundColor: "rgba(0, 0, 0, .32)",
  position: "fixed",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  "@motionSafe": {
    "&[data-state='open']": {
      animation: `${fadeIn} ${animationSpeed.in} ease-out`,
    },
    "&[data-state='closed']": {
      animation: `${fadeOut} ${animationSpeed.out} ease-in`,
    },
  },
});

export interface IDialogProps
  extends React.ComponentProps<typeof DialogPrimitive.Root> {}

export const Dialog: React.FC<IDialogProps> = ({ children, ...props }) => (
  <DialogPrimitive.Root {...props}>
    <DialogOverlay />
    {children}
  </DialogPrimitive.Root>
);

const DialogContentRoot = styled(DialogPrimitive.Content, {
  include: "box",
  $$margin: "$space$8",
  $$padding: "$space$4",
  $$fauxMargin: "$$margin * 2",
  $$translate: "calc(-50% - ($$fauxMargin))",
  $$inset: "calc(50% + $$fauxMargin)",
  $$maxSize: "calc(100% - $$fauxMargin)",
  padding: 0,
  position: "fixed",
  top: "$$inset",
  left: "$$inset",
  transform: "translate($$translate, $$translate)",
  transformOrigin: "0 0",
  width: "$$maxSize",
  maxHeight: "$$maxSize",
  backgroundColor: "$background",
  borderRadius: "$md",
  boxShadow: "$2xl",
  overflowX: "hidden",
  overflowY: "auto",
  "&:focus": {
    outline: "none",
  },
  "@motionSafe": {
    willChange: "transform",
    "&[data-state='open']": {
      animation: `${fadeInZoom} ${animationSpeed.in} ease-out`,
    },
    "&[data-state='closed']": {
      animation: `${fadeOut} ${animationSpeed.out} ease-in`,
    },
  },
  variants: {
    size: {
      sm: {
        maxWidth: "$sm",
      },
    },
  },
  defaultVariants: {
    size: "sm",
  },
});

export type TDialogContentVariants = ExtractVariants<typeof DialogContentRoot>;
export interface IDialogContentProps
  extends ICSSProp,
    TDialogContentVariants,
    Polymorphic.OwnProps<typeof DialogPrimitive.Content> {}
export type TDialogContentComponent = Polymorphic.ForwardRefComponent<
  Polymorphic.IntrinsicElement<typeof DialogPrimitive.Content>,
  IDialogContentProps
>;

export const DialogContent = React.forwardRef(
  ({ children, ...props }, forwardedRef) => (
    <DialogContentRoot {...props} ref={forwardedRef}>
      {children}
    </DialogContentRoot>
  )
) as TDialogContentComponent;

export const DialogHeader = styled("header", {
  include: "box",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  padding: "$$padding",
});

export const DialogTitle: THeadingComponent = React.forwardRef(
  (props, forwardedRef) => <Heading ref={forwardedRef} size="xl" {...props} />
);

export const DialogBody = styled("div", {
  include: "box",
  paddingLeft: "$$padding",
  paddingRight: "$$padding",
});

export const DialogFooter = styled("footer", {
  include: "box",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  padding: "$$padding",
});
