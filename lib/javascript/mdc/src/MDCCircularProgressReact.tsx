import * as React from "react";
import { MDCCircularProgress } from "@material/circular-progress";
import { RefManager } from "@orchest/lib-utils";

// used only in orchest-webserver
export class MDCCircularProgressReact extends React.Component<any> {
  refManager: RefManager;
  mdc: MDCCircularProgress;

  constructor() {
    // @ts-ignore
    super();

    this.refManager = new RefManager();
  }

  componentDidMount() {
    this.mdc = new MDCCircularProgress(this.refManager.refs.progress);
  }

  render() {
    let topClasses = [
      "mdc-circular-progress",
      "mdc-circular-progress--indeterminate",
    ];

    if (this.props.classNames) {
      topClasses = topClasses.concat(this.props.classNames);
    }

    return (
      <div
        ref={this.refManager.nrefs.progress}
        className={topClasses.join(" ")}
        role="progressbar"
        aria-label="Circular Progress Bar"
        // @ts-ignore
        aria-valuemin="0"
        // @ts-ignore
        aria-valuemax="1"
      >
        <div className="mdc-circular-progress__determinate-container">
          <svg
            className="mdc-circular-progress__determinate-circle-graphic"
            viewBox="0 0 32 32"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              className="mdc-circular-progress__determinate-track"
              cx={16}
              cy={16}
              r="12.5"
              strokeWidth={3}
            />
            <circle
              className="mdc-circular-progress__determinate-circle"
              cx={16}
              cy={16}
              r="12.5"
              strokeDasharray="78.54"
              strokeDashoffset="78.54"
              strokeWidth={3}
            />
          </svg>
        </div>
        <div className="mdc-circular-progress__indeterminate-container">
          <div className="mdc-circular-progress__spinner-layer">
            <div className="mdc-circular-progress__circle-clipper mdc-circular-progress__circle-left">
              <svg
                className="mdc-circular-progress__indeterminate-circle-graphic"
                viewBox="0 0 32 32"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  cx={16}
                  cy={16}
                  r="12.5"
                  strokeDasharray="78.54"
                  strokeDashoffset="39.27"
                  strokeWidth={3}
                />
              </svg>
            </div>
            <div className="mdc-circular-progress__gap-patch">
              <svg
                className="mdc-circular-progress__indeterminate-circle-graphic"
                viewBox="0 0 32 32"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  cx={16}
                  cy={16}
                  r="12.5"
                  strokeDasharray="78.54"
                  strokeDashoffset="39.27"
                  strokeWidth="2.4"
                />
              </svg>
            </div>
            <div className="mdc-circular-progress__circle-clipper mdc-circular-progress__circle-right">
              <svg
                className="mdc-circular-progress__indeterminate-circle-graphic"
                viewBox="0 0 32 32"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  cx={16}
                  cy={16}
                  r="12.5"
                  strokeDasharray="78.54"
                  strokeDashoffset="39.27"
                  strokeWidth={3}
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
