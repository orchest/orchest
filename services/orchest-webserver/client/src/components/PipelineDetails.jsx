// @ts-check
// @TODO - Functional Component Transformation (then remove lines 1-2)
//         https://github.com/orchest/orchest/issues/259
import React from "react";
import { RefManager } from "@orchest/lib-utils";
import { MDCButtonReact, MDCTabBarReact } from "@orchest/lib-mdc";
import PipelineDetailsProperties from "./PipelineDetailsProperties";
import PipelineDetailsLogs from "./PipelineDetailsLogs";

class PipelineDetails extends React.Component {
  constructor(props) {
    super(props);

    let index = 0;

    if (this.props.defaultViewIndex) {
      index = this.props.defaultViewIndex;
    }

    this.state = {
      subviewIndex: index,
      draggingPaneColumn: false,
      paneWidth: this.getPaneWidth(),
    };

    this.refManager = new RefManager();
  }

  componentWillUnmount() {
    // @ts-ignore
    $(window).off("resize.pipelineDetails");
    // @ts-ignore
    $(window).off("mousemove.pipelineDetails");
    // @ts-ignore
    $(window).off("mouseup.pipelineDetails");
  }

  onOpenNotebook() {
    this.props.onOpenNotebook();
  }

  onOpenFilePreviewView(step_uuid) {
    if (this.props.onOpenFilePreviewView) {
      this.props.onOpenFilePreviewView(step_uuid);
    }
  }

  componentDidMount() {
    // overflow checks
    // @ts-ignore
    $(window).on("resize.pipelineDetails", this.overflowChecks.bind(this));
    // @ts-ignore
    $(window).on("mousemove.pipelineDetails", this.onMouseMove.bind(this));
    // @ts-ignore
    $(window).on("mousedown.pipelineDetails", this.onMouseDown.bind(this));
    // @ts-ignore
    $(window).on("mouseup.pipelineDetails", this.onMouseUp.bind(this));
    this.overflowChecks();
  }

  onMouseMove(e) {
    if (this.state.draggingPaneColumn) {
      this.setState((state, _) => {
        let deltaX = e.clientX - this.draggingPreviousClientX;
        this.draggingPreviousClientX = e.clientX;

        return {
          paneWidth: Math.max(0, Math.max(50, state.paneWidth - deltaX)),
        };
      });
    }
  }

  onMouseDown(e) {
    this.draggingPreviousClientX = e.clientX;
  }

  onMouseUp() {
    if (this.state.draggingPaneColumn) {
      this.setState({
        draggingPaneColumn: false,
      });
      this.savePaneWidth(this.state.paneWidth);
    }
  }

  // TODO: refactor to use OverflowListener
  overflowChecks() {
    // @ts-ignore
    $(".overflowable").each(function () {
      // @ts-ignore
      if ($(this).overflowing()) {
        // @ts-ignore
        $(this).addClass("overflown");
      } else {
        // @ts-ignore
        $(this).removeClass("overflown");
      }
    });
  }

  onSelectSubview(index) {
    this.setState({
      subviewIndex: index,
    });
    this.props.onChangeView(index);
  }

  onColumnResizeMouseDown() {
    this.setState({
      draggingPaneColumn: true,
    });
  }

  getPaneWidth() {
    let initialPaneWidth = 450;
    let paneWidth = initialPaneWidth;

    let storedPaneWidth = window.localStorage.getItem(
      "orchest.pipelinedetails.paneWidth"
    );
    if (storedPaneWidth != null) {
      paneWidth = parseFloat(storedPaneWidth);
    }

    return paneWidth;
  }

  savePaneWidth(width) {
    window.localStorage.setItem("orchest.pipelinedetails.paneWidth", width);
  }

  render() {
    let subView = undefined;

    switch (this.state.subviewIndex) {
      case 0:
        subView = (
          <PipelineDetailsProperties
            project_uuid={this.props.project_uuid}
            pipeline_uuid={this.props.pipeline.uuid}
            pipelineCwd={this.props.pipelineCwd}
            readOnly={this.props.readOnly}
            onNameUpdate={this.props.onNameUpdate}
            onSave={this.props.onSave}
            connections={this.props.connections}
            step={this.props.step}
            onChange={this.props.onChange}
            saveHash={this.props.saveHash}
          />
        );
        break;
      case 1:
        subView = (
          <PipelineDetailsLogs
            sio={this.props.sio}
            project_uuid={this.props.project_uuid}
            job_uuid={this.props.job_uuid}
            run_uuid={this.props.run_uuid}
            step_uuid={this.props.step.uuid}
            pipeline_uuid={this.props.pipeline.uuid}
          />
        );
    }

    return (
      <div
        className={"pipeline-details pane"}
        style={{ width: this.state.paneWidth + "px" }}
      >
        <div
          className="col-drag-resize"
          onMouseDown={this.onColumnResizeMouseDown.bind(this)}
        ></div>
        <div className={"overflowable"}>
          <div className="input-group">
            <MDCTabBarReact
              ref={this.refManager.nrefs.tabBar}
              selectedIndex={this.state.subviewIndex}
              items={["Properties", "Logs"]}
              icons={["tune", "view_headline"]}
              onChange={this.onSelectSubview.bind(this)}
            />
          </div>

          {subView}
        </div>

        <div className={"action-buttons-bottom"}>
          {(() => {
            return (
              <div className={"file-actions"}>
                {!this.props.readOnly && (
                  <MDCButtonReact
                    icon="launch"
                    classNames={[
                      "mdc-button--raised",
                      "themed-secondary",
                      "push-right",
                    ]}
                    label="Edit in JupyterLab"
                    onClick={this.onOpenNotebook.bind(this)}
                  />
                )}
                <MDCButtonReact
                  icon="visibility"
                  classNames={["mdc-button--raised"]}
                  label="View file"
                  onClick={this.onOpenFilePreviewView.bind(
                    this,
                    this.props.step.uuid
                  )}
                />
              </div>
            );
          })()}

          <div className={"general-actions"}>
            <MDCButtonReact
              icon="close"
              label="Close"
              onClick={this.props.onClose.bind(this)}
            />

            {(() => {
              if (!this.props.readOnly) {
                return (
                  <MDCButtonReact
                    icon="delete"
                    label="Delete"
                    onClick={this.props.onDelete.bind(this)}
                  />
                );
              }
            })()}
          </div>
        </div>
      </div>
    );
  }
}

export default PipelineDetails;
