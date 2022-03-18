import { Code } from "@/components/common/Code";
import { useAppContext } from "@/contexts/AppContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useFetchPipelines } from "@/hooks/useFetchPipelines";
import { siteMap } from "@/Routes";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { usePipelineEditorContext } from "../contexts/PipelineEditorContext";
import { cleanFilePath, isFileByExtension, isFromDataFolder } from "./common";
import { FileManager } from "./FileManager";

export const ProjectFileManager = () => {
  const { setAlert, setConfirm } = useAppContext();
  const { navigateTo, jobUuid } = useCustomRoute();
  const {
    openNotebook,
    projectUuid,
    pipelineUuid,
    isReadOnly,
    pipelineJson,
    runUuid,
  } = usePipelineEditorContext();

  const { pipelines } = useFetchPipelines(projectUuid);

  const { isJobRun, jobRunQueryArgs } = React.useMemo(() => {
    return {
      isJobRun: hasValue(jobUuid) && hasValue(runUuid),
      jobRunQueryArgs: { jobUuid, runUuid },
    };
  }, [jobUuid, runUuid]);

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
            move it to <Code>Project files</Code>.
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

  return (
    <FileManager
      isReadOnly={isReadOnly}
      onEdit={onEdit}
      onOpen={onOpen}
      onView={onView}
    />
  );
};
