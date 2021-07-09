import * as React from "react";
import { MDCTooltip } from "@material/tooltip";
import { RefManager } from "@orchest/lib-utils";

// used only in orchest-webserver
export class MDCTooltipReact extends React.Component<any> {
  refManager: RefManager;
  mdc: MDCTooltip;

  constructor() {
    // @ts-ignore
    super();
    this.refManager = new RefManager();
  }

  componentDidMount() {
    this.mdc = new MDCTooltip(this.refManager.refs.tooltip);
  }

  render() {
    if (this.props.type == "rich") {
      return (
        <div className="mdc-tooltip-wrapper--rich">
          <div
            id={this.props.tooltipID}
            ref={this.refManager.nrefs.tooltip}
            className="mdc-tooltip mdc-tooltip--rich"
            aria-hidden="true"
            role="tooltip"
          >
            <div className="mdc-tooltip__surface mdc-tooltip__surface-animation">
              <p className="mdc-tooltip__content">{this.props.tooltip}</p>
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div
          id={this.props.tooltipID}
          ref={this.refManager.nrefs.tooltip}
          className="mdc-tooltip"
          role="tooltip"
          aria-hidden="true"
        >
          <div className="mdc-tooltip__surface mdc-tooltip__surface-animation">
            {this.props.tooltip}
          </div>
        </div>
      );
    }
  }
}
