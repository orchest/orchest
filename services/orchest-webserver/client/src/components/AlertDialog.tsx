import * as React from "react";
import { MDCButtonReact, MDCDialogReact } from "@orchest/lib-mdc";
import { RefManager } from "@orchest/lib-utils";

export interface IAlertDialogProps {
  title: string;
  onClose: () => void;
  content: string;
}

const AlertDialog: React.FC<IAlertDialogProps> = (props) => {
  const [refManager] = React.useState(new RefManager());

  const close = () => {
    refManager.refs.dialogRef.close();
  };

  return (
    <MDCDialogReact
      ref={refManager.nrefs.dialogRef}
      {...props}
      actions={
        <MDCButtonReact
          classNames={["mdc-button--raised", "themed-secondary"]}
          submitButton
          label="Ok"
          onClick={close.bind(this)}
        />
      }
    />
  );
};

export default AlertDialog;
