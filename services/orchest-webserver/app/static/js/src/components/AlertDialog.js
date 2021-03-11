import React from "react";
import MDCDialogReact from "../lib/mdc-components/MDCDialogReact";
import MDCButtonReact from "../lib/mdc-components/MDCButtonReact";
import { RefManager } from "../lib/utils/all";

class AlertDialog extends React.Component {
  constructor() {
    super();

    this.refManager = new RefManager();
  }

  close() {
    this.refManager.refs.dialogRef.close();
  }

  render() {
    return (
      <MDCDialogReact
        ref={this.refManager.nrefs.dialogRef}
        title={this.props.title}
        onClose={this.props.onClose}
        content={this.props.content}
        actions={
          <MDCButtonReact
            classNames={["mdc-button--raised", "themed-secondary"]}
            submitButton
            label="Ok"
            onClick={this.close.bind(this)}
          />
        }
      />
    );
  }
}

export default AlertDialog;
