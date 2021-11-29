import {
  Confirm,
  PromptMessage,
  PromptMessageType,
  useAppContext,
} from "@/contexts/AppContext";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { MDCButtonReact } from "@orchest/lib-mdc";
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
    if (promptMessage && promptMessage.type === "alert") {
      // Analytics call
      const { title, content } = promptMessage;
      sendEvent("alert show", { title, content });
    }
  }, [sendEvent, promptMessage]);

  if (!promptMessage) return null;

  const confirm = () => {
    if (promptMessage.onConfirm) promptMessage.onConfirm();
    deletePromptMessage();
  };

  const isCancellable = checkCancellable(promptMessage);

  const cancel = () => {
    if (isCancellable && promptMessage.onCancel) promptMessage.onCancel();
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
      <DialogTitle>{promptMessage.title || "Error"}</DialogTitle>
      <DialogContent>{promptMessage.content}</DialogContent>
      <DialogActions>
        {isCancellable && <MDCButtonReact label="Cancel" onClick={cancel} />}
        <MDCButtonReact
          classNames={["mdc-button--raised", "themed-secondary"]}
          submitButton
          label="Confirm"
          onClick={confirm}
        />
      </DialogActions>
    </Dialog>
  );
};
