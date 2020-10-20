import React, { Fragment } from "react";
import MDCDialogReact from "../lib/mdc-components/MDCDialogReact";
import MDCButtonReact from "../lib/mdc-components/MDCButtonReact";
import { RefManager } from "../lib/utils/all";

class ConfirmDialog extends React.Component {
  constructor() {
    super();

    this.refManager = new RefManager();
  }

  confirm() {
    this.refManager.refs.dialog.close();

    if (this.props.onConfirm) {
      this.props.onConfirm();
    }
  }

  cancel() {
    this.refManager.refs.dialog.close();

    if (this.props.onCancel) {
      this.props.onCancel();
    }
  }

  render() {
    return (
      <MDCDialogReact
        ref={this.refManager.nrefs.dialog}
        title={this.props.title}
        onClose={this.props.onClose}
        content={<p>{this.props.content}</p>}
        actions={
          <Fragment>
            <MDCButtonReact label="Ok" onClick={this.confirm.bind(this)} />
            <MDCButtonReact label="Cancel" onClick={this.cancel.bind(this)} />
          </Fragment>
        }
      />
    );
  }
}

export default ConfirmDialog;
