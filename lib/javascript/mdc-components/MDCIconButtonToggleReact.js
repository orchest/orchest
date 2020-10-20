import React from "react";
import { MDCIconButtonToggle } from "@material/icon-button";
import { RefManager } from "../utils/all";

class MDCIconButtonToggleReact extends React.Component {
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
        ref={this.refManager.nrefs.button}
        className="mdc-icon-button material-icons"
      >
        {this.props.icon}
      </button>
    );
  }
}

export default MDCIconButtonToggleReact;
