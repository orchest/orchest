import React, { Fragment } from "react";
import { MDCRipple } from "@material/ripple";
import { RefManager } from "../utils/all";

class MDCButtonReact extends React.Component {
  constructor() {
    super();

    this.refManager = new RefManager();
  }
  componentDidMount() {
    this.mdc = new MDCRipple(this.refManager.refs.button);
  }

  click() {
    this.mdc.activate();
    if (this.props.onClick) {
      this.props.onClick();
    }
    this.mdc.deactivate();
  }

  render() {
    let topClasses = ["mdc-button"];

    if (this.props.classNames) {
      topClasses = topClasses.concat(this.props.classNames);
    }
    topClasses = topClasses.join(" ");

    return (
      <button
        disabled={this.props.disabled === true}
        style={
          this.props.disabled === true
            ? { pointerEvents: "none", cursor: "default" }
            : {}
        }
        ref={this.refManager.nrefs.button}
        onClick={this.props.onClick}
        className={topClasses}
        type={this.props.submitButton ? "submit" : "button"}
      >
        <div className="mdc-button__ripple"></div>

        {(() => {
          if (this.props.icon && this.props.label !== undefined) {
            return (
              <Fragment>
                <i className="material-icons mdc-button__icon">
                  {this.props.icon}
                </i>
                <span className="mdc-button__label">{this.props.label}</span>
              </Fragment>
            );
          }
          if (this.props.icon) {
            return <i className="material-icons">{this.props.icon}</i>;
          }
          if (this.props.label !== undefined) {
            return (
              <span className="mdc-button__label">{this.props.label}</span>
            );
          }
        })()}
      </button>
    );
  }
}

export default MDCButtonReact;
