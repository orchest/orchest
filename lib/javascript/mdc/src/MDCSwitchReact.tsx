import * as React from "react";

import { RefManager, uuidv4 } from "@orchest/lib-utils";

import { MDCSwitch } from "@material/switch";

// used only in orchest-webserver
export class MDCSwitchReact extends React.Component<any> {
  refManager: RefManager;
  mdc: MDCSwitch;

  constructor() {
    // @ts-ignore
    super();

    this.refManager = new RefManager();
  }

  componentDidMount() {
    this.mdc = new MDCSwitch(this.refManager.refs.switch);
  }

  onChange(e) {
    if (this.props.onChange) {
      this.props.onChange(e);
    }
  }

  render() {
    let mdcClasses = ["mdc-switch"];
    if (this.props.on === true) {
      mdcClasses.push("mdc-switch--selected");
    } else {
      mdcClasses.push("mdc-switch--unselected");
    }
    let topClasses = ["mdc-switch-wrapper"];
    if (this.props.classNames) {
      topClasses = topClasses.concat(this.props.classNames);
    }

    let randomFor = uuidv4();

    return (
      <div className={topClasses.join(" ")}>
        <button
          id={randomFor}
          role="switch"
          onClick={this.onChange.bind(this)}
          className={mdcClasses.join(" ")}
          ref={this.refManager.nrefs.switch}
          aria-checked={this.props.on === true ? "true" : "false"}
          disabled={this.props.disabled}
        >
          <div className="mdc-switch__track"></div>
          <div className="mdc-switch__handle-track">
            <div className="mdc-switch__handle">
              <div className="mdc-switch__shadow">
                <div className="mdc-elevation-overlay"></div>
              </div>
              <div className="mdc-switch__ripple"></div>
              <div className="mdc-switch__icons">
                <svg
                  className="mdc-switch__icon mdc-switch__icon--on"
                  viewBox="0 0 24 24"
                >
                  <path d="M19.69,5.23L8.96,15.96l-4.23-4.23L2.96,13.5l6,6L21.46,7L19.69,5.23z" />
                </svg>
                <svg
                  className="mdc-switch__icon mdc-switch__icon--off"
                  viewBox="0 0 24 24"
                >
                  <path d="M20 13H4v-2h16v2z" />
                </svg>
              </div>
            </div>
          </div>
        </button>
        {this.props.label && (
          <label htmlFor={randomFor}>{this.props.label}</label>
        )}
      </div>
    );
  }
}
