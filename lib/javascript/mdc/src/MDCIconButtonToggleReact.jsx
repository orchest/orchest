import React from "react";
import { MDCIconButtonToggle } from "@material/icon-button";
import { RefManager } from "@orchest/lib-utils";

// used only in orchest-webserver
export class MDCIconButtonToggleReact extends React.Component {
  constructor() {
    super();

    this.refManager = new RefManager();
  }
  componentDidMount() {
    this.mdc = new MDCIconButtonToggle(this.refManager.refs.button);

    this.mdc.listen("MDCIconButtonToggle:change", (e) => {
      this.props.onClick();
    });
  }

  click() {
    this.mdc.activate();
    if (this.props.onClick) {
      this.props.onClick();
    }
    this.mdc.deactivate();
  }

  render() {
    return (
      <button
        aria-describedby={this.props["aria-describedby"]}
        ref={this.refManager.nrefs.button}
        title={this.props.tooltipText}
        className="mdc-icon-button material-icons"
        type={this.props.submitButton ? "submit" : "button"}
      >
        {this.props.icon}
      </button>
    );
  }
}
