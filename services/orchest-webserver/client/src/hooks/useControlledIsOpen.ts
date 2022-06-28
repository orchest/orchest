import { hasValue } from "@orchest/lib-utils";
import React from "react";

export const useControlledIsOpen = (
  isOpenByParent?: boolean,
  onCloseByParent?: () => void
) => {
  // If `open` and `onClose` are provided, `isOpen` is controlled by its parent component.
  const isControlled = hasValue(isOpenByParent) || hasValue(onCloseByParent);

  const [isOpenLocally, setIsOpen] = React.useState(false);
  const isOpen = hasValue(isOpenByParent) ? isOpenByParent : isOpenLocally;

  const onOpen = React.useCallback(() => {
    if (!isControlled) setIsOpen(true);
  }, [isControlled]);

  const onClose = React.useCallback(() => {
    if (isControlled && onCloseByParent) {
      onCloseByParent();
      return;
    }
    setIsOpen(false);
  }, [isControlled, onCloseByParent]);

  return { isOpen, onOpen, onClose };
};
