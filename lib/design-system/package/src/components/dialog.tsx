import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import type * as Polymorphic from "@radix-ui/react-polymorphic";
import { styled } from "../core";
import { IconButton } from "./icon-button";

const StyledOverlay = styled(DialogPrimitive.Overlay, {
  backgroundColor: "rgba(0, 0, 0, .32)",
  position: "fixed",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
});

interface IDialogProps
  extends React.ComponentProps<typeof DialogPrimitive.Root> {}

export const Dialog: React.FC<IDialogProps> = ({ children, ...props }) => (
  <DialogPrimitive.Root {...props}>
    <StyledOverlay />
    {children}
  </DialogPrimitive.Root>
);

const StyledContent = styled(DialogPrimitive.Content, {
  backgroundColor: "$background",
  borderRadius: "$md",
  boxShadow: "$2xl",
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  minWidth: "16rem",
  maxHeight: "85vh",
  padding: "$4",
  marginTop: "-5vh",
  "&:focus": {
    outline: "none",
  },
});

const StyledCloseButton = styled(IconButton, {
  position: "absolute",
  top: "$2",
  right: "$2",
});

type DialogContentOwnProps = Polymorphic.OwnProps<
  typeof DialogPrimitive.Content
> & {
  css?: any;
};

type DialogContentComponent = Polymorphic.ForwardRefComponent<
  Polymorphic.IntrinsicElement<typeof DialogPrimitive.Content>,
  DialogContentOwnProps
>;

export const DialogContent = React.forwardRef(
  ({ children, ...props }, forwardedRef) => (
    <StyledContent {...props} ref={forwardedRef}>
      {children}
      <DialogPrimitive.Close
        as={StyledCloseButton}
        label="Close"
        variant="ghost"
      >
        x
      </DialogPrimitive.Close>
    </StyledContent>
  )
) as DialogContentComponent;

export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
