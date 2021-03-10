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

  onOpened() {
    if (this.refManager.refs.okButton) {
      this.refManager.refs.okButton.focus();
    }
  }

  render() {
    return (
      <MDCDialogReact
        ref={this.refManager.nrefs.dialog}
        title={this.props.title}
        onClose={this.props.onClose}
        onOpened={this.onOpened.bind(this)}
        content={<p>{this.props.content}</p>}
        actions={
          <Fragment>
            <MDCButtonReact
              label="Cancel"
              classNames={["push-right"]}
              onClick={this.cancel.bind(this)}
            />
            <MDCButtonReact
              classNames={["mdc-button--raised", "themed-secondary"]}
              submitButton
              ref={this.refManager.nrefs.okButton}
              label="Ok"
              onClick={this.confirm.bind(this)}
            />
          </Fragment>
        }
      />
    );
  }
}

export default ConfirmDialog;
