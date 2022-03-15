import { Code } from "@/components/common/Code";
import { useAppContext } from "@/contexts/AppContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/Routes";
import { Step } from "@/types";
import { getOffset } from "@/utils/jquery-replacement";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import { uuidv4 } from "@orchest/lib-utils";
import React from "react";
import { getScaleCorrectedPosition } from "../common";
import { usePipelineEditorContext } from "../contexts/PipelineEditorContext";
import { STEP_HEIGHT, STEP_WIDTH } from "../PipelineStep";
import { cleanFilePath, getStepFilePath } from "./common";
import { FileManager } from "./FileManager";

const isNotebookFile = (filePath: string) => /\.ipynb$/.test(filePath);

export const ProjectFileManager = () => {
  const { setAlert } = useAppContext();
  const { navigateTo, jobUuid } = useCustomRoute();
  const {
    mouseTracker,
    pipelineCanvasRef,
    environments,
    dispatch,
    eventVars,
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

  const isJobRun = jobUuid && runUuid;
  const jobRunQueryArgs = React.useMemo(() => ({ jobUuid, runUuid }), [
    jobUuid,
    runUuid,
  ]);

  const environment = environments.length > 0 ? environments[0] : null;

  return (
    <FileManager
      onDropOutside={(props, selected) => {
        const clientPosition = {
          x: mouseTracker.current.client.x - STEP_WIDTH / 2,
          y: mouseTracker.current.client.y - STEP_HEIGHT / 2,
        };
        const { x, y } = getScaleCorrectedPosition({
          offset: getOffset(pipelineCanvasRef.current),
          position: clientPosition,
          scaleFactor: eventVars.scaleFactor,
        });

        const position = [x, y] as [number, number];

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
                position,
                hidden: false,
              },
            },
          });
        });
      }}
      onEdit={(filePath) => {
        openNotebook(undefined, cleanFilePath(filePath));
      }}
      onOpen={(filePath) => {
        openNotebook(undefined, cleanFilePath(filePath));
      }}
      onSelect={(filePath) => {
        console.log("DEV onSelect", filePath);
        // TODO: check if it's notebook file
        // disallow it to be moved to /data
      }}
      onView={(filePath) => {
        const foundStep = Object.values(pipelineJson.steps).find((step) => {
          return (
            step.file_path.replace(/^\.\//, "") === cleanFilePath(filePath)
          );
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
      }}
    />
  );
};
