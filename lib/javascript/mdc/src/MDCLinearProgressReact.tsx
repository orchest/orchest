import * as React from "react";
import { MDCLinearProgress } from "@material/linear-progress";
import { RefManager } from "@orchest/lib-utils";

// used only in orchest-webserver
export class MDCLinearProgressReact extends React.Component<any> {
  refManager: RefManager;
  mdc: MDCLinearProgress;

  constructor() {
    // @ts-ignore
    super();

    this.refManager = new RefManager();
  }

  componentDidMount() {
    this.mdc = new MDCLinearProgress(this.refManager.refs.progress);
  }

  render() {
    let topClasses = ["mdc-linear-progress mdc-linear-progress--indeterminate"];

    if (this.props.classNames) {
      topClasses = topClasses.concat(this.props.classNames);
    }

    return (
      <div
        role="progressbar"
        ref={this.refManager.nrefs.progress}
        className={topClasses.join(" ")}
        aria-label="Progress Bar"
      >
        <div className="mdc-linear-progress__buffer">
          <div className="mdc-linear-progress__buffer-bar"></div>
          <div className="mdc-linear-progress__buffer-dots"></div>
        </div>
        <div className="mdc-linear-progress__bar mdc-linear-progress__primary-bar">
          <span className="mdc-linear-progress__bar-inner"></span>
        </div>
        <div className="mdc-linear-progress__bar mdc-linear-progress__secondary-bar">
          <span className="mdc-linear-progress__bar-inner"></span>
        </div>
      </div>
    );
  }
}
