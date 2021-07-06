// @ts-check
// @TODO - Functional Component Transformation (then remove lines 1-2)
//         https://github.com/orchest/orchest/issues/259
import React from "react";
import { RefManager } from "@orchest/lib-utils";
import { MDCButtonReact, MDCTabBarReact } from "@orchest/lib-mdc";
import PipelineDetailsProperties from "./PipelineDetailsProperties";
import PipelineDetailsLogs from "./PipelineDetailsLogs";

const PipelineDetails = (props) => {
  const { $ } = window;
  const index = props.defaultViewIndex || 0;

  const getPaneWidth = () => {
    let initialPaneWidth = 450;
    let paneWidth = initialPaneWidth;

    let storedPaneWidth = window.localStorage.getItem(
      "orchest.pipelinedetails.paneWidth"
    );
    if (storedPaneWidth != null) {
      paneWidth = parseFloat(storedPaneWidth);
    }

    return paneWidth;
  };

  const [state, setState] = React.useState({
    subviewIndex: index,
    draggingPaneColumn: false,
    paneWidth: getPaneWidth(),
    draggingPreviousClientX: null,
  });

  const [refManager] = React.useState(new RefManager());

  const onOpenNotebook = () => props.onOpenNotebook();

  const onOpenFilePreviewView = (step_uuid) =>
    props.onOpenFilePreviewView && props.onOpenFilePreviewView(step_uuid);

  const onMouseMove = (e) => {
    if (state.draggingPaneColumn) {
      setState((prevState) => {
        const deltaX = e.clientX - prevState.draggingPreviousClientX;

        return {
          ...prevState,
          paneWidth: Math.max(0, Math.max(50, state.paneWidth - deltaX)),
          draggingPreviousClientX: e.clientX,
        };
      });
    }
  };

  const onMouseDown = (e) => {
    console.log(e);
    setState((prevState) => ({
      ...prevState,
      draggingPreviousClientX: e.clientX,
    }));
  };

  const onMouseUp = () => {
    if (state.draggingPaneColumn) {
      setState((prevState) => ({
        ...prevState,
        draggingPaneColumn: false,
      }));

      savePaneWidth(state.paneWidth);
    }
  };

  // TODO: refactor to use OverflowListener
  const overflowChecks = () => {
    $(".overflowable").each(function () {
      if ($(this).overflowing()) {
        $(this).addClass("overflown");
      } else {
        $(this).removeClass("overflown");
      }
    });
  };

  const onSelectSubview = (index) => {
    setState((prevState) => ({
      ...prevState,
      subviewIndex: index,
    }));
    props.onChangeView(index);
  };

  const onColumnResizeMouseDown = () => {
    setState((prevState) => ({
      ...prevState,
      draggingPaneColumn: true,
    }));
  };

  const savePaneWidth = (width) => {
    window.localStorage.setItem("orchest.pipelinedetails.paneWidth", width);
  };

  React.useEffect(() => {
    // overflow checks
    $(window).on("resize.pipelineDetails", overflowChecks.bind(this));
    $(window).on("mousemove.pipelineDetails", onMouseMove.bind(this));
    $(window).on("mousedown.pipelineDetails", onMouseDown.bind(this));
    $(window).on("mouseup.pipelineDetails", onMouseUp.bind(this));
    overflowChecks();

    return () => {
      $(window).off("resize.pipelineDetails");
      $(window).off("mousemove.pipelineDetails");
      $(window).off("mouseup.pipelineDetails");
    };
  }, []);

  let subView = undefined;

  switch (state.subviewIndex) {
    case 0:
      subView = (
        <PipelineDetailsProperties
          project_uuid={props.project_uuid}
          pipeline_uuid={props.pipeline.uuid}
          pipelineCwd={props.pipelineCwd}
          readOnly={props.readOnly}
          onNameUpdate={props.onNameUpdate}
          onSave={props.onSave}
          connections={props.connections}
          step={props.step}
          onChange={props.onChange}
          saveHash={props.saveHash}
        />
      );
      break;
    case 1:
      subView = (
        <PipelineDetailsLogs
          sio={props.sio}
          project_uuid={props.project_uuid}
          job_uuid={props.job_uuid}
          run_uuid={props.run_uuid}
          step_uuid={props.step.uuid}
          pipeline_uuid={props.pipeline.uuid}
        />
      );
  }

  return (
    <div
      className={"pipeline-details pane"}
      style={{ width: state.paneWidth + "px" }}
    >
      <div
        className="col-drag-resize"
        onMouseDown={onColumnResizeMouseDown.bind(this)}
      ></div>
      <div className={"overflowable"}>
        <div className="input-group">
          <MDCTabBarReact
            ref={refManager.nrefs.tabBar}
            selectedIndex={state.subviewIndex}
            items={["Properties", "Logs"]}
            icons={["tune", "view_headline"]}
            onChange={onSelectSubview.bind(this)}
          />
        </div>

        {subView}
      </div>

      <div className={"action-buttons-bottom"}>
        {(() => {
          return (
            <div className={"file-actions"}>
              {!props.readOnly && (
                <MDCButtonReact
                  icon="launch"
                  classNames={[
                    "mdc-button--raised",
                    "themed-secondary",
                    "push-right",
                  ]}
                  label="Edit in JupyterLab"
                  onClick={onOpenNotebook.bind(this)}
                />
              )}
              <MDCButtonReact
                icon="visibility"
                classNames={["mdc-button--raised"]}
                label="View file"
                onClick={onOpenFilePreviewView.bind(this, props.step.uuid)}
              />
            </div>
          );
        })()}

        <div className={"general-actions"}>
          <MDCButtonReact
            icon="close"
            label="Close"
            onClick={props.onClose.bind(this)}
          />

          {(() => {
            if (!props.readOnly) {
              return (
                <MDCButtonReact
                  icon="delete"
                  label="Delete"
                  onClick={props.onDelete.bind(this)}
                />
              );
            }
          })()}
        </div>
      </div>
    </div>
  );
};

export default PipelineDetails;
