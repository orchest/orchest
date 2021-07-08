import * as React from "react";
import { MDCButtonReact, MDCDialogReact } from "@orchest/lib-mdc";
import { RefManager } from "@orchest/lib-utils";

export interface IConfirmDialogProps {
  title?: any;
  onCancel?: any;
  onClose?: any;
  onConfirm?: any;
  content?: any;
}

const ConfirmDialog: React.FC<IConfirmDialogProps> = (props) => {
  const [refManager] = React.useState(new RefManager());

  const confirm = () => {
    refManager.refs.dialog.close();

    if (props.onConfirm) {
      props.onConfirm();
    }
  };

  const cancel = () => {
    refManager.refs.dialog.close();

    if (props.onCancel) {
      props.onCancel();
    }
  };

  const onOpened = () => {
    if (refManager.refs.okButton) {
      refManager.refs.okButton.focus();
    }
  };

  return (
    <MDCDialogReact
      ref={refManager.nrefs.dialog}
      title={props.title}
      onClose={props.onClose}
      onOpened={onOpened.bind(this)}
      content={props.content && <p>{props.content}</p>}
      actions={
        <React.Fragment>
          <MDCButtonReact
            label="Cancel"
            classNames={["push-right"]}
            onClick={cancel.bind(this)}
          />
          <MDCButtonReact
            classNames={["mdc-button--raised", "themed-secondary"]}
            submitButton
            ref={refManager.nrefs.okButton}
            label="Ok"
            onClick={confirm.bind(this)}
          />
        </React.Fragment>
      }
    />
  );
};

export default ConfirmDialog;
