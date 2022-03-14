import {
  Confirm,
  PromptMessage,
  PromptMessageType,
  useAppContext,
} from "@/contexts/AppContext";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { hasValue, typedIncludes } from "@orchest/lib-utils";
import React from "react";

type CancellableMessage = Extract<PromptMessage, Confirm>;
type CancellableType = Extract<PromptMessageType, "confirm">;
const cancellableTypes: CancellableType[] = ["confirm"];
// use type guard to ensure the promptMessage is cancellable
const checkCancellable = (
  message: PromptMessage
): message is CancellableMessage => {
  return typedIncludes(cancellableTypes, message.type);
};

export const SystemDialog: React.FC = () => {
  const { state, deletePromptMessage } = useAppContext();
  const promptMessage =
    state.promptMessages.length > 0 ? state.promptMessages[0] : null;

  const sendEvent = useSendAnalyticEvent();

  React.useEffect(() => {
    if (promptMessage) {
      // Analytics call
      const { title, content } = promptMessage;
      sendEvent(`${promptMessage.type} show`, { title, content });
    }
  }, [sendEvent, promptMessage]);

  if (!promptMessage) return null;

  const confirm = async () => {
    if (promptMessage.onConfirm) await promptMessage.onConfirm();
    deletePromptMessage();
  };

  const isCancellable = checkCancellable(promptMessage);

  const cancel = async () => {
    if (isCancellable && promptMessage.onCancel) await promptMessage.onCancel();
    deletePromptMessage();
  };

  // handles when user click away the dialog
  const dialogOnClose = () => {
    // if the prompt message is cancellable, we cancel it and do nothing
    if (isCancellable) {
      cancel();
      return;
    }
    // below we handle click-away behavior case by case
    // ==============================================================================
    // alert is not cancellable, when user click away, it's seen as "confirm"
    if (promptMessage.type === "alert") confirm();
  };

  return (
    <Dialog open={hasValue(promptMessage)} onClose={dialogOnClose}>
      <form
        id={`${promptMessage.type}-form`}
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          confirm();
        }}
      >
        <DialogTitle>{promptMessage.title || "Error"}</DialogTitle>
        <DialogContent>{promptMessage.content}</DialogContent>
        <DialogActions>
          {isCancellable && (
            <Button color="secondary" onClick={cancel} tabIndex={-1}>
              {promptMessage.cancelLabel || "Cancel"}
            </Button>
          )}
          <Button
            type="submit"
            autoFocus
            form={`${promptMessage.type}-form`}
            variant="contained"
            data-test-id="confirm-dialog-ok"
          >
            {promptMessage.confirmLabel || "Confirm"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
