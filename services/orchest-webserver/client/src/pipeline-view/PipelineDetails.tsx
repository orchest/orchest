import { useDragElement } from "@/hooks/useDragElement";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { MDCButtonReact, MDCTabBarReact } from "@orchest/lib-mdc";
import { RefManager } from "@orchest/lib-utils";
import React from "react";
import PipelineDetailsLogs from "./PipelineDetailsLogs";
import PipelineDetailsProperties from "./PipelineDetailsProperties";

const PipelineDetails: React.FC<any> = ({ defaultViewIndex = 0, ...props }) => {
  const [storedPanelWidth, setStoredPanelWidth] = useLocalStorage(
    "pipelinedetails.panelWidth",
    450
  );

  const eventVars = React.useRef({
    prevClientX: 0,
    cumulativeDeltaX: 0,
  });

  const [panelWidth, setPanelWidth] = React.useState(storedPanelWidth);

  const [subViewIndex, setSubViewIndex] = React.useState(defaultViewIndex);

  const [refManager] = React.useState(new RefManager());

  const onOpenNotebook = () => props.onOpenNotebook();
  const onOpenFilePreviewView = (step_uuid: string) =>
    props.onOpenFilePreviewView && props.onOpenFilePreviewView(step_uuid);

  const onStartDragging = React.useCallback((e: React.MouseEvent) => {
    eventVars.current.prevClientX = e.clientX;
    eventVars.current.cumulativeDeltaX = 0;
  }, []);

  const onDragging = React.useCallback((e) => {
    eventVars.current.cumulativeDeltaX +=
      e.clientX - eventVars.current.prevClientX;
    eventVars.current.prevClientX = e.clientX;
    setPanelWidth((prevPanelWidth) => {
      let newPanelWidth = Math.max(
        50, // panelWidth min: 50px
        prevPanelWidth - eventVars.current.cumulativeDeltaX
      );
      eventVars.current.cumulativeDeltaX = 0;
      return newPanelWidth;
    });
  }, []);

  const onStopDragging = React.useCallback(() => {
    setPanelWidth((panelWidth) => {
      setStoredPanelWidth(panelWidth);
      return panelWidth;
    });
  }, [setStoredPanelWidth]);

  const startDragging = useDragElement({
    onStartDragging,
    onDragging,
    onStopDragging,
  });

  const overflowable = React.useRef<HTMLDivElement>();
  const onOverflown = React.useCallback(() => {
    if (overflowable.current) {
      overflowable.current.classList.add("overflown");
    }
  }, []);

  React.useEffect(() => {
    window.addEventListener("overflow", onOverflown, false);
    const overflowableElement = overflowable.current;
    return () => {
      window.removeEventListener("overflow", onOverflown);
      if (overflowableElement) {
        overflowableElement.classList.remove("overflown");
      }
    };
  }, [onOverflown]);

  const onSelectSubView = (index) => {
    setSubViewIndex(index);
    props.onChangeView(index);
  };

  return (
    <div className="pipeline-details pane" style={{ width: panelWidth + "px" }}>
      <div className="col-drag-resize" onMouseDown={startDragging} />
      <div ref={overflowable} className={"overflowable"}>
        <div className="input-group">
          <MDCTabBarReact
            ref={refManager.nrefs.tabBar}
            selectedIndex={subViewIndex}
            items={["Properties", "Logs"]}
            icons={["tune", "view_headline"]}
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
                projectUuid={props.project_uuid}
                jobUuid={props.job_uuid}
                runUuid={props.run_uuid}
                stepUuid={props.step.uuid}
                pipelineUuid={props.pipeline.uuid}
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
