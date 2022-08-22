import {
  Confirm,
  PromptMessage,
  PromptMessageType,
  useGlobalContext,
} from "@/contexts/GlobalContext";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { setRefs } from "@/utils/refs";
import Button, { ButtonProps } from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { hasValue, typedIncludes, uuidv4 } from "@orchest/lib-utils";
import React from "react";

type CancellableMessage = Extract<PromptMessage, Confirm>;
type CancellableType = Extract<PromptMessageType, "confirm">;
const cancelableTypes: CancellableType[] = ["confirm"];
// use type guard to ensure the promptMessage is cancelable
const checkCancellable = (
  message: PromptMessage
): message is CancellableMessage => {
  return typedIncludes(cancelableTypes, message.type);
};

// If the trigger of the Dialog is also a keydown, setting the default prop `autoFocus` to `true` will also trigger the button click.
// We intentionally break it with eventloop.
const DelayedFocusButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  function DelayedFocusButtonComponent({ autoFocus, ...props }, ref) {
    const localRef = React.useRef<HTMLButtonElement>();

    React.useEffect(() => {
      const timeout = window.setTimeout(() => {
        if (localRef.current) {
          localRef.current.focus();
        }
      }, 0);
      return () => window.clearTimeout(timeout);
    }, []);

    return <Button ref={setRefs(localRef, ref)} {...props} />;
  }
);

export const SystemDialog = () => {
  const {
    state: { promptMessages },
    deletePromptMessage,
  } = useGlobalContext();
  const promptMessage = promptMessages.length > 0 ? promptMessages[0] : null;

  const sendEvent = useSendAnalyticEvent();

  React.useEffect(() => {
    if (promptMessage) {
      // Analytics call
      const { title, content } = promptMessage;
      sendEvent(`${promptMessage.type}:shown`, { title, content });
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
    // if the prompt message is cancelable, we cancel it and do nothing
    if (isCancellable) {
      cancel();
      return;
    }
    // below we handle click-away behavior case by case
    // ==============================================================================
    // alert is not cancelable, when user click away, it's seen as "confirm"
    if (promptMessage.type === "alert") confirm();
  };

  return (
    <Dialog open={hasValue(promptMessage)} onClose={dialogOnClose}>
      <form
        id={`${promptMessage.type}-form`}
        key={`${promptMessage.type}-form-${uuidv4()}`}
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
            <Button onClick={cancel} tabIndex={-1}>
              {promptMessage.cancelLabel || "Cancel"}
            </Button>
          )}
          <DelayedFocusButton
            type="submit"
            form={`${promptMessage.type}-form`}
            variant="contained"
            color={promptMessage.confirmButtonColor}
            data-test-id="confirm-dialog-ok"
          >
            {promptMessage.confirmLabel || "Confirm"}
          </DelayedFocusButton>
        </DialogActions>
      </form>
    </Dialog>
  );
};
