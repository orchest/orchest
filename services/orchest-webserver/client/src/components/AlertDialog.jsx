// @ts-check
import React from "react";
import { MDCButtonReact, MDCDialogReact } from "@orchest/lib-mdc";
import { RefManager } from "@orchest/lib-utils";

/**
 * @param {Object} props
 * @param {any} [props.title]
 * @param {any} [props.onClose]
 * @param {any} [props.content]
 */
const AlertDialog = (props) => {
  const refManager = new RefManager();

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
