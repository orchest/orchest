import React from "react";

/** A simple hook that is useful when maintaining the `isOpen` state of a dialog. */
export const useOpenDialog = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const open = React.useCallback(() => setIsOpen(true), []);
  const close = React.useCallback(() => setIsOpen(false), []);

  return [isOpen, open, close] as const;
};
