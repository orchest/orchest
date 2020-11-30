import React from "react";
import MDCTabBarReact from "../lib/mdc-components/MDCTabBarReact";
import PipelineDetailsProperties from "./PipelineDetailsProperties";
import PipelineDetailsLogs from "./PipelineDetailsLogs";
import MDCButtonReact from "../lib/mdc-components/MDCButtonReact";
import { RefManager } from "../lib/utils/all";

class PipelineDetails extends React.Component {
  constructor(props) {
    super(props);

    let index = 0;

    if (this.props.defaultViewIndex) {
      index = this.props.defaultViewIndex;
    }

    this.state = {
      subviewIndex: index,
    };

    this.refManager = new RefManager();
  }

  componentWillUnmount() {
    $(document).off("mouseup.connectionList");
    $(document).off("mousemove.connectionList");
    $(window).off("resize.pipelineDetails");
    $(window).off("keyup.pipelineDetails");
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
    $(window).on("resize.pipelineDetails", this.overflowChecks.bind(this));
    this.overflowChecks();
  }

  overflowChecks() {
    $(".overflowable").each(function () {
      if ($(this).overflowing()) {
        $(this).addClass("overflown");
      } else {
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

  render() {
    let subView = undefined;

    switch (this.state.subviewIndex) {
      case 0:
        subView = (
          <PipelineDetailsProperties
            project_uuid={this.props.project_uuid}
            pipeline_uuid={this.props.pipeline.uuid}
            readOnly={this.props.readOnly}
            onNameUpdate={this.props.onNameUpdate}
            onSave={this.props.onSave}
            connections={this.props.connections}
            step={this.props.step}
            onChange={this.props.onChange}
          />
        );
        break;
      case 1:
        subView = (
          <PipelineDetailsLogs
            sio={this.props.sio}
            project_uuid={this.props.project_uuid}
            pipelineRun={this.props.pipelineRun}
            step={this.props.step}
            pipeline={this.props.pipeline}
          />
        );
    }

    return (
      <div className={"pipeline-details pane"}>
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
