import { Code } from "@/components/common/Code";
import { useAppContext } from "@/contexts/AppContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/Routes";
import { Position, Step } from "@/types";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import { hasValue, uuidv4 } from "@orchest/lib-utils";
import React from "react";
import { usePipelineEditorContext } from "../contexts/PipelineEditorContext";
import { cleanFilePath, getStepFilePath, isNotebookFile } from "./common";
import { FileManager } from "./FileManager";

export const ProjectFileManager = () => {
  const { setAlert } = useAppContext();
  const { navigateTo, jobUuid } = useCustomRoute();
  const {
    environments,
    dispatch,
    openNotebook,
    projectUuid,
    pipelineUuid,
    isReadOnly,
    pipelineJson,
    runUuid,
  } = usePipelineEditorContext();

  const allNotebookFileSteps = React.useMemo(() => {
    return Object.values(pipelineJson?.steps || {}).reduce((all, step) => {
      const filePath = getStepFilePath(step);
      if (isNotebookFile(filePath)) {
        return [...all, { ...step, file_path: filePath }];
      }
      return all;
    }, [] as Step[]);
  }, [pipelineJson]);

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
      openNotebook(undefined, cleanFilePath(filePath));
    },
    [openNotebook]
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

  const createStepsWithFiles = React.useCallback(
    (selected: string[], dropPosition: Position) => {
      const { forbidden, allowed } = selected.reduce(
        (all, curr) => {
          const foundStep = allNotebookFileSteps.find((step) => {
            return step.file_path === cleanFilePath(curr);
          });

          return foundStep
            ? { ...all, forbidden: [...all.forbidden, cleanFilePath(curr)] }
            : { ...all, allowed: [...all.allowed, cleanFilePath(curr)] };
        },
        { forbidden: [], allowed: [] }
      );

      if (forbidden.length > 0) {
        setAlert(
          "Warning",
          <Stack spacing={2} direction="column">
            <Box>
              Following Notebook files have already been used in the pipeline.
              Assigning the same Notebook file to multiple steps is not
              supported. Please convert to a script to re-use file across
              pipeline steps.
            </Box>
            <ul>
              {forbidden.map((file) => (
                <Box key={file}>
                  <Code>{cleanFilePath(file)}</Code>
                </Box>
              ))}
            </ul>
          </Stack>
        );
      }

      allowed.forEach((filePath) => {
        dispatch({
          type: "CREATE_STEP",
          payload: {
            title: "",
            uuid: uuidv4(),
            incoming_connections: [],
            file_path: filePath,
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
      allNotebookFileSteps,
      dispatch,
      environment?.language,
      environment?.name,
      environment?.uuid,
      setAlert,
    ]
  );

  const onDropOutside = React.useCallback(
    (target: EventTarget, selected: string[], dropPosition: Position) => {
      // assign a file to a step cannot be handled here because PipelineStep onMouseUp has e.stopPropagation()
      // here we only handle "create a new step".
      const targetElement = target as HTMLElement;
      if (targetElement.id === "pipeline-canvas") {
        createStepsWithFiles(selected, dropPosition);
      }
    },
    [createStepsWithFiles]
  );

  return (
    <FileManager
      onDropOutside={onDropOutside}
      onEdit={onEdit}
      onOpen={onOpen}
      onView={onView}
    />
  );
};
