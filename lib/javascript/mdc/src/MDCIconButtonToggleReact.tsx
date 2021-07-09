import * as React from "react";
import { MDCIconButtonToggle } from "@material/icon-button";
import { RefManager } from "@orchest/lib-utils";

// used only in orchest-webserver
export class MDCIconButtonToggleReact extends React.Component<any> {
  refManager: RefManager;
  mdc: MDCIconButtonToggle;

  constructor() {
    // @ts-ignore
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
    // @ts-ignore
    this.mdc.activate();
    if (this.props.onClick) {
      this.props.onClick();
    }
    // @ts-ignore
    this.mdc.deactivate();
  }

  render() {
    return (
      <button
        aria-describedby={this.props["aria-describedby"]}
        ref={this.refManager.nrefs.button}
        disabled={this.props.disabled === true}
        title={this.props.tooltipText}
        className="mdc-icon-button material-icons"
        type={this.props.submitButton ? "submit" : "button"}
      >
        {this.props.icon}
      </button>
    );
  }
}
