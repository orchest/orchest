import { useAppContext } from "@/contexts/AppContext";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { MDCButtonReact } from "@orchest/lib-mdc";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

const AlertDialog: React.FC = ({}) => {
  const { state, deleteAlert } = useAppContext();
  const sendEvent = useSendAnalyticEvent;
  const alert = state.alerts.length > 0 ? state.alerts[0] : null;

  React.useEffect(() => {
    if (alert) {
      // Analytics call
      const { title, content } = alert;
      sendEvent("alert show", { title, content });
    }
  }, [alert]);

  if (!alert) return null;

  const onClose = () => {
    if (alert.onClose) alert.onClose();
    deleteAlert();
  };

  return (
    <Dialog open={hasValue(alert)} onClose={onClose}>
      <DialogTitle>{alert.title || "Error"}</DialogTitle>
      <DialogContent>{alert.content}</DialogContent>
      <DialogActions>
        <MDCButtonReact
          classNames={["mdc-button--raised", "themed-secondary"]}
          submitButton
          label="Ok"
          onClick={onClose}
        />
      </DialogActions>
    </Dialog>
  );
};

export default AlertDialog;
