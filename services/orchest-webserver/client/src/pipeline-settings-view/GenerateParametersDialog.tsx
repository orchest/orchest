import { Code } from "@/components/common/Code";
import { useAppContext } from "@/contexts/AppContext";
import { useFetchPipelineJson } from "@/hooks/useFetchPipelineJson";
import {
  FILE_MANAGEMENT_ENDPOINT,
  queryArgs,
} from "@/pipeline-view/file-manager/common";
import {
  generateStrategyJson,
  pipelinePathToJsonLocation,
} from "@/utils/webserver-utils";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import { fetcher, hasValue } from "@orchest/lib-utils";
import React from "react";
import { Controlled as CodeMirror } from "react-codemirror2";

export const GenerateParametersDialog = ({
  isOpen,
  onClose,
  pipelinePath,
  projectUuid,
  pipelineUuid,
}: {
  isOpen: boolean;
  onClose: () => void;
  pipelinePath: string | undefined;
  projectUuid: string | undefined;
  pipelineUuid: string | undefined;
}) => {
  const { pipelineJson, isFetchingPipelineJson } = useFetchPipelineJson({
    projectUuid,
    pipelineUuid,
  });

  const { config, setConfirm } = useAppContext();

  const [copyButtonText, setCopyButtontext] = React.useState("Copy");

  const pipelineJsonToParams = (pipelineJson) => {
    if (!pipelineJson || !config?.PIPELINE_PARAMETERS_RESERVED_KEY) {
      return "";
    }
    let strategyJson = generateStrategyJson(
      pipelineJson,
      config?.PIPELINE_PARAMETERS_RESERVED_KEY
    );

    // Cast parameters values to JSON
    Object.keys(strategyJson).forEach((key) => {
      Object.keys(strategyJson[key].parameters).forEach((paramKey) => {
        strategyJson[key].parameters[paramKey] = JSON.parse(
          strategyJson[key].parameters[paramKey]
        );
      });
      strategyJson[key] = strategyJson[key].parameters;
    });

    return JSON.stringify(strategyJson, null, 2);
  };

  const copyParams = () => {
    navigator.clipboard.writeText(pipelineJsonToParams(pipelineJson));
    setCopyButtontext("Copied!");
  };

  const writeFile = (body, path, pipelineUuid, projectUuid) => {
    fetcher(
      `${FILE_MANAGEMENT_ENDPOINT}/create?${queryArgs({
        project_uuid: projectUuid,
        pipeline_uuid: pipelineUuid,
        path: path.startsWith("/") ? path : "/" + path,
        overwrite: "true",
        root: "/project-dir",
        use_project_root: "true",
      })}`,
      { body, method: "POST" }
    );
  };

  const createParamFile = async () => {
    let body = pipelineJsonToParams(pipelineJson);
    let filePath = pipelinePathToJsonLocation(pipelinePath ? pipelinePath : "");

    if (!projectUuid || !pipelineUuid || !filePath) {
      return;
    }

    // Check if file exists
    fetcher(
      `${FILE_MANAGEMENT_ENDPOINT}/exists?${queryArgs({
        project_uuid: projectUuid,
        pipeline_uuid: pipelineUuid,
        path: filePath,
        use_project_root: "true",
      })}`
    )
      .then((response) => {
        if (hasValue(response)) {
          setConfirm(
            "Warning",
            "This file already exists, do you want to overwrite it?",
            async (resolve) => {
              writeFile(body, filePath, pipelineUuid, projectUuid);
              onClose();
              resolve(true);
              return true;
            }
          );
        }
      })
      .catch((response) => {
        if (response.status == 404) {
          writeFile(body, filePath, pipelineUuid, projectUuid);
          onClose();
        }
      });
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{ sx: { overflowY: "visible" } }}
    >
      <form id="generate-parameters">
        <DialogTitle>Pipeline parameters file</DialogTitle>
        <DialogContent sx={{ overflowY: "visible" }}>
          <Stack direction="column" spacing={2}>
            <Box>
              <span>The parameter file will be created at: </span>
              <Code>
                {pipelinePathToJsonLocation(pipelinePath ? pipelinePath : "")}
              </Code>
            </Box>
            {isFetchingPipelineJson && <LinearProgress />}
            {!isFetchingPipelineJson && (
              <CodeMirror
                value={pipelineJsonToParams(pipelineJson)}
                onBeforeChange={() => null}
                options={{
                  mode: "application/json",
                  theme: "jupyter",
                  lineNumbers: true,
                }}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="secondary" onClick={onClose}>
            Close
          </Button>
          <Button color="secondary" onClick={copyParams}>
            {copyButtonText}
          </Button>
          <Button variant="contained" onClick={createParamFile}>
            Create file
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
