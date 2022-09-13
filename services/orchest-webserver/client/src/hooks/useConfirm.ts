import { CancelHandler, useGlobalContext } from "@/contexts/GlobalContext";
import { AnyFunction } from "@/types";
import { ButtonProps } from "@mui/material/Button";
import React from "react";

export type ConfirmOptions = {
  title?: string;
  content: string | React.ReactElement;
  confirmButtonColor?: ButtonProps["color"];
  confirmLabel?: string;
  cancelLabel?: string;
  onCancel?: CancelHandler;
};

/** Opens a dialog that prompts the user to confirm the provided action. */
export const useConfirm = <F extends AnyFunction>(
  action: F,
  {
    title = "Confirm",
    content,
    confirmButtonColor,
    confirmLabel,
    cancelLabel,
    onCancel,
  }: ConfirmOptions
) => {
  const { setConfirm } = useGlobalContext();

  return React.useCallback(
    (...args: Parameters<F>) =>
      setConfirm(title, content, {
        confirmButtonColor,
        confirmLabel,
        cancelLabel,
        onCancel,
        onConfirm: async (resolve) => {
          await action(...args);
          resolve(true);
          return true;
        },
      }),
    [
      action,
      cancelLabel,
      confirmButtonColor,
      confirmLabel,
      content,
      setConfirm,
      onCancel,
      title,
    ]
  );
};
