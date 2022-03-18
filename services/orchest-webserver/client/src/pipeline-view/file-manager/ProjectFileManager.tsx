import { Code } from "@/components/common/Code";
import { useAppContext } from "@/contexts/AppContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useFetchPipelines } from "@/hooks/useFetchPipelines";
import { siteMap } from "@/Routes";
import { Position } from "@/types";
import { hasValue, uuidv4 } from "@orchest/lib-utils";
import React from "react";
import { usePipelineEditorContext } from "../contexts/PipelineEditorContext";
import { STEP_HEIGHT, STEP_WIDTH } from "../PipelineStep";
import {
  cleanFilePath,
  getFilePathForDragFile,
  isFileByExtension,
  isFromDataFolder,
} from "./common";
import { FileManager } from "./FileManager";
import { useFileManagerContext } from "./FileManagerContext";
import { useValidateFilesOnSteps } from "./useValidateFilesOnSteps";

export const ProjectFileManager = () => {
  const { setAlert, setConfirm } = useAppContext();
  const { navigateTo, jobUuid } = useCustomRoute();
  const {
    environments,
    dispatch,
    openNotebook,
    projectUuid,
    pipelineUuid,
    pipelineCwd,
    isReadOnly,
    pipelineJson,
    runUuid,
    getOnCanvasPosition,
  } = usePipelineEditorContext();

  const { pipelines } = useFetchPipelines(projectUuid);

  const { selectedFiles } = useFileManagerContext();

  const { isJobRun, jobRunQueryArgs } = React.useMemo(() => {
    return {
      isJobRun: hasValue(jobUuid) && hasValue(runUuid),
      jobRunQueryArgs: { jobUuid, runUuid },
    };
  }, [jobUuid, runUuid]);

  const environment = environments.length > 0 ? environments[0] : null;

  const onEdit = React.useCallback(
    (filePath) => {
      openNotebook(undefined, cleanFilePath(filePath));
    },
    [openNotebook]
  );

  const onOpen = React.useCallback(
    (filePath) => {
      if (
        isFromDataFolder(filePath) &&
        isFileByExtension(["orchest", "ipynb"], filePath)
      ) {
        setAlert(
          "Notice",
          <>
            This file cannot be opened from within <Code>/data</Code>. Please
            move it to <Code>Project files</Code>
          </>
        );
        return;
      }

      const foundPipeline = isFileByExtension(["orchest"], filePath)
        ? pipelines.find(
            (pipeline) => pipeline.path === cleanFilePath(filePath)
          )
        : null;

      if (foundPipeline && foundPipeline.uuid !== pipelineUuid) {
        setConfirm(
          "Confirm",
          <>
            Are you sure you want to open pipeline <b>{foundPipeline.name}</b>?
          </>,
          {
            onConfirm: async (resolve) => {
              navigateTo(siteMap.pipeline.path, {
                query: { projectUuid, pipelineUuid: foundPipeline.uuid },
              });
              resolve(true);
              return true;
            },
            onCancel: async (resolve) => {
              resolve(false);
              return false;
            },
            confirmLabel: "Open pipeline",
            cancelLabel: "Cancel",
          }
        );
        return;
      }

      if (foundPipeline && foundPipeline.uuid === pipelineUuid) {
        setAlert("Notice", "This pipeline is already open.");
        return;
      }

      openNotebook(undefined, cleanFilePath(filePath));
    },
    [
      openNotebook,
      pipelines,
      navigateTo,
      projectUuid,
      pipelineUuid,
      setAlert,
      setConfirm,
    ]
  );

  const onView = React.useCallback(
    (filePath) => {
      const foundStep = Object.values(pipelineJson.steps).find((step) => {
        return step.file_path.replace(/^\.\//, "") === cleanFilePath(filePath);
      });

      if (!foundStep) {
        setAlert(
          "Warning",
          <div>
            <Code>{cleanFilePath(filePath)}</Code> is not yet used in this
            pipeline. To preview the file, you need to assign this file to a
            step first.
          </div>
        );
        return;
      }

      navigateTo(siteMap.filePreview.path, {
        query: {
          projectUuid,
          pipelineUuid,
          stepUuid: foundStep.uuid,
          ...(isJobRun ? jobRunQueryArgs : undefined),
        },
        state: { isReadOnly },
      });
    },
    [
      isJobRun,
      isReadOnly,
      jobRunQueryArgs,
      navigateTo,
      pipelineJson?.steps,
      pipelineUuid,
      projectUuid,
      setAlert,
    ]
  );

  const getApplicableStepFiles = useValidateFilesOnSteps();

  const createStepsWithFiles = React.useCallback(
    (selected: string[], dropPosition: Position) => {
      const { allowed } = getApplicableStepFiles();

      allowed.forEach((filePath) => {
        dispatch({
          type: "CREATE_STEP",
          payload: {
            title: "",
            uuid: uuidv4(),
            incoming_connections: [],
            file_path: getFilePathForDragFile(filePath, pipelineCwd),
            kernel: {
              name: environment?.language || "python",
              display_name: environment?.name || "Python",
            },
            environment: environment?.uuid,
            parameters: {},
            meta_data: {
              position: [dropPosition.x, dropPosition.y],
              hidden: false,
            },
          },
        });
      });
    },
    [
      dispatch,
      pipelineCwd,
      getApplicableStepFiles,
      environment?.language,
      environment?.name,
      environment?.uuid,
    ]
  );

  const onDropOutside = React.useCallback(
    (target: EventTarget, dropPosition: Position) => {
      // assign a file to a step cannot be handled here because PipelineStep onMouseUp has e.stopPropagation()
      // here we only handle "create a new step".
      const targetElement = target as HTMLElement;
      if (targetElement.id === "pipeline-canvas") {
        createStepsWithFiles(selectedFiles, dropPosition);
      }
    },
    [createStepsWithFiles, selectedFiles]
  );

  const getDropPosition = React.useCallback(() => {
    return getOnCanvasPosition({ x: STEP_WIDTH / 2, y: STEP_HEIGHT / 2 });
  }, [getOnCanvasPosition]);

  return (
    <FileManager
      isReadOnly={isReadOnly}
      onDropOutside={onDropOutside}
      onEdit={onEdit}
      onOpen={onOpen}
      onView={onView}
      getDropPosition={getDropPosition}
    />
  );
};
