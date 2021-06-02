import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import type * as Polymorphic from "@radix-ui/react-polymorphic";
import { styled } from "../core";
import { ExtractVariants, ICSSProp } from "../types";
import { Heading, THeadingComponent } from "./heading";

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

interface IDialogContentProps
  extends ICSSProp,
    ExtractVariants<typeof DialogContentRoot>,
    Polymorphic.OwnProps<typeof DialogPrimitive.Content> {}

type TDialogContentComponent = Polymorphic.ForwardRefComponent<
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

export const DialogTitle = React.forwardRef((props, forwardedRef) => (
  <Heading ref={forwardedRef} size="xl" {...props} />
)) as THeadingComponent;

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
