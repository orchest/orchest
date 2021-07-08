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

  const [isDragging, setIsDragging] = React.useState(false);
  const [clientX, setClientX] = React.useState({
    previous: null,
    current: null,
  });
  const [paneWidth, setPaneWidth] = React.useState(
    storedPaneWidth != null ? parseFloat(storedPaneWidth) : null
  );
  const [subViewIndex, setSubViewIndex] = React.useState(defaultViewIndex);

  const [refManager] = React.useState(new RefManager());

  const onOpenNotebook = () => props.onOpenNotebook();
  const onOpenFilePreviewView = (step_uuid) =>
    props.onOpenFilePreviewView && props.onOpenFilePreviewView(step_uuid);

  const onMouseMove = (e) =>
    setClientX((prev) => ({
      previous: prev.current,
      current: e.clientX,
    }));
  const onMouseDown = (e) =>
    setClientX({ previous: e.clientX, current: e.clientX });

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

  const onColumnResizeMouseDown = () => setIsDragging(true);
  const onColumnResizeMouseUp = () => {
    if (isDragging) {
      setStoredPaneWidth(paneWidth.toString());
      setIsDragging(false);
    }
  };

  React.useEffect(() => {
    // overflow checks
    overflowChecks();

    $(window).on("resize.pipelineDetails", overflowChecks.bind(this));
    $(window).on("mousemove.pipelineDetails", onMouseMove.bind(this));
    $(window).on("mousedown.pipelineDetails", onMouseDown.bind(this));

    return () => {
      $(window).off("resize.pipelineDetails");
      $(window).off("mousemove.pipelineDetails");
      $(window).off("mousedown.pipelineDetails");
    };
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      const deltaX = clientX.current - clientX.previous;
      setPaneWidth((prevPaneWidth) =>
        Math.max(0, Math.max(50, prevPaneWidth - deltaX))
      );
    }
  }, [clientX, isDragging]);

  return (
    <div className="pipeline-details pane" style={{ width: paneWidth + "px" }}>
      <div
        className="col-drag-resize"
        onMouseDown={onColumnResizeMouseDown.bind(this)}
        onMouseUp={onColumnResizeMouseUp.bind(this)}
      />
      <div className={"overflowable"}>
        <div className="input-group">
          <MDCTabBarReact
            ref={refManager.nrefs.tabBar}
            selectedIndex={subViewIndex}
            items={["Properties", "Logs"]}
            icons={["tune", "view_headline"]}
            V
            onChange={onSelectSubView.bind(this)}
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
                project_uuid={props.project_uuid}
                job_uuid={props.job_uuid}
                run_uuid={props.run_uuid}
                step_uuid={props.step.uuid}
                pipeline_uuid={props.pipeline.uuid}
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
        <div className={"general-actions"}>
          <MDCButtonReact
            icon="close"
            label="Close"
            onClick={props.onClose.bind(this)}
          />
          {!props.readOnly && (
            <MDCButtonReact
              icon="delete"
              label="Delete"
              onClick={props.onDelete.bind(this)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default PipelineDetails;
