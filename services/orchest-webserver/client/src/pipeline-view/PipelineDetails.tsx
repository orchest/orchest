import * as React from "react";
import { RefManager } from "@orchest/lib-utils";
import { MDCButtonReact, MDCTabBarReact } from "@orchest/lib-mdc";
import PipelineDetailsProperties from "./PipelineDetailsProperties";
import PipelineDetailsLogs from "./PipelineDetailsLogs";
import { useLocalStorage } from "@/hooks/local-storage";

const PipelineDetails: React.FC<any> = ({ defaultViewIndex = 0, ...props }) => {
  const { $ } = window;

  const [storedPaneWidth, setStoredPaneWidth] = useLocalStorage(
    "pipelinedetails.paneWidth",
    "450"
  );

  const [, setIsDragging] = React.useState(false);
  const [eventVars] = React.useState({
    prevClientX: 0,
    cumulativeDeltaX: 0,
  });

  const [paneWidth, setPaneWidth] = React.useState(
    storedPaneWidth != null ? parseFloat(storedPaneWidth) : null
  );
  const [subViewIndex, setSubViewIndex] = React.useState(defaultViewIndex);

  const [refManager] = React.useState(new RefManager());

  const onOpenNotebook = () => props.onOpenNotebook();
  const onOpenFilePreviewView = (step_uuid: string) =>
    props.onOpenFilePreviewView && props.onOpenFilePreviewView(step_uuid);

  const onMouseMove = (e) => {
    let prevClientX = eventVars.prevClientX;
    eventVars.prevClientX = e.clientX;
    eventVars.cumulativeDeltaX += e.clientX - prevClientX;

    setIsDragging((isDragging) => {
      if (isDragging) {
        setPaneWidth((prevPaneWidth) => {
          let newPaneWidth = Math.max(
            0,
            Math.max(50, prevPaneWidth - eventVars.cumulativeDeltaX)
          );

          eventVars.cumulativeDeltaX = 0;
          return newPaneWidth;
        });
      }
      return isDragging;
    });
  };

  const onMouseUp = () => {
    onColumnResizeMouseUp();
  };

  const onMouseDown = (e) => {
    eventVars.prevClientX = e.clientX;
  };

  const onColumnResizeMouseUp = () => {
    // This pattern allows you to use the latest state
    // value in event handlers that are captured
    // when the functional component is first initialized.
    setIsDragging((isDragging) => {
      if (isDragging) {
        setPaneWidth((paneWidth) => {
          setStoredPaneWidth(paneWidth.toString());
          return paneWidth;
        });
        return false;
      } else {
        return isDragging;
      }
    });
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

  const onSelectSubView = (index) => {
    setSubViewIndex(index);
    props.onChangeView(index);
  };

  const onColumnResizeMouseDown = () => {
    eventVars.cumulativeDeltaX = 0;
    setIsDragging(true);
  };

  React.useEffect(() => {
    // overflow checks
    overflowChecks();

    $(window).on("resize.pipelineDetails", overflowChecks);
    $(window).on("mousemove.pipelineDetails", onMouseMove);
    $(window).on("mousedown.pipelineDetails", onMouseDown);
    $(window).on("mouseup.pipelineDetails", onMouseUp);

    return () => {
      $(window).off("resize.pipelineDetails");
      $(window).off("mousemove.pipelineDetails");
      $(window).off("mousedown.pipelineDetails");
      $(window).off("mouseup.pipelineDetails");
    };
  }, []);

  return (
    <div className="pipeline-details pane" style={{ width: paneWidth + "px" }}>
      <div
        className="col-drag-resize"
        onMouseDown={onColumnResizeMouseDown}
        onMouseUp={onColumnResizeMouseUp}
      />
      <div className={"overflowable"}>
        <div className="input-group">
          <MDCTabBarReact
            ref={refManager.nrefs.tabBar}
            selectedIndex={subViewIndex}
            items={["Properties", "Logs"]}
            icons={["tune", "view_headline"]}
            V
            onChange={onSelectSubView}
          />
        </div>

        {
          {
            0: (
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
            ),
            1: (
              <PipelineDetailsLogs
                sio={props.sio}
                projectId={props.project_uuid}
                jobId={props.job_uuid}
                runId={props.run_uuid}
                stepId={props.step.uuid}
                pipelineId={props.pipeline.uuid}
              />
            ),
          }[subViewIndex]
        }
      </div>

      <div className={"action-buttons-bottom"}>
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
              onClick={onOpenNotebook}
              data-test-id="step-view-in-jupyterlab"
            />
          )}
          <MDCButtonReact
            icon="visibility"
            classNames={["mdc-button--raised"]}
            label="View file"
            onClick={() => onOpenFilePreviewView(props.step.uuid)}
            data-test-id="step-view-file"
          />
        </div>
        <div className={"general-actions"}>
          <MDCButtonReact
            icon="close"
            label="Close"
            onClick={props.onClose}
            data-test-id="step-close-details"
          />
          {!props.readOnly && (
            <MDCButtonReact
              icon="delete"
              label="Delete"
              onClick={props.onDelete}
              data-test-id="step-delete"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default PipelineDetails;
