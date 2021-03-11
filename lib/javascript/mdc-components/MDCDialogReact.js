import React from "react";
import { MDCDialog } from "@material/dialog";
import { RefManager } from "../utils/all";

class MDCDialogReact extends React.Component {
  constructor() {
    super();

    this.refManager = new RefManager();
  }
  componentDidMount() {
    this.mdc = new MDCDialog(this.refManager.refs.dialog);
    this.mdc.open();

    this.mdc.listen("MDCDialog:closed", () => {
      if (this.props.onClose) {
        this.props.onClose();
      }
    });
    this.mdc.listen("MDCDialog:opened", () => {
      if (this.props.onOpened) {
        this.props.onOpened();
      }
    });
  }

  close() {
    this.mdc.close();
  }

  render() {
    return (
      <div
        ref={this.refManager.nrefs.dialog}
        className="mdc-dialog"
        role="alertdialog"
        aria-modal="true"
        tabIndex="0"
        aria-labelledby="my-dialog-title"
        aria-describedby="my-dialog-content"
      >
        <div className="mdc-dialog__container">
          <div className="mdc-dialog__surface">
            <form
              onSubmit={(e) => {
                e.preventDefault();
              }}
            >
              <h2 className="mdc-dialog__title" id="my-dialog-title">
                {this.props.title}
              </h2>
              <div className="mdc-dialog__content" id="my-dialog-content">
                {this.props.content}
              </div>
              <footer className="mdc-dialog__actions">
                {this.props.actions}
              </footer>
            </form>
          </div>
        </div>
        <div className="mdc-dialog__scrim"></div>
      </div>
    );
  }
}

export default MDCDialogReact;
