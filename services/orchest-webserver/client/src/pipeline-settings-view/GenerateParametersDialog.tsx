import { Code } from "@/components/common/Code";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { isValidFile } from "@/hooks/useCheckFileValidity";
import { useDebounce } from "@/hooks/useDebounce";
import { useFetchPipelineJson } from "@/hooks/useFetchPipelineJson";
import { useParameterReservedKey } from "@/jobs-view/job-view/hooks/useParameterReservedKey";
import { ParameterDocs } from "@/pipeline-settings-view/PipelineSettingsView";
import { FILE_MANAGEMENT_ENDPOINT } from "@/pipeline-view/file-manager/common";
import { PipelineJson } from "@/types";
import { copyToClipboard } from "@/utils/copyToClipboard";
import { isValidJson } from "@/utils/isValidJson";
import { queryArgs } from "@/utils/text";
import {
  generateStrategyJson,
  pipelinePathToJsonLocation,
} from "@/utils/webserver-utils";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import { Controlled as CodeMirror } from "react-codemirror2";

export const pipelineJsonToParams = (
  pipelineJson: PipelineJson | undefined,
  reservedKey: string | undefined
) => {
  if (!pipelineJson || !reservedKey) {
    return "";
  }
  let strategyJson = generateStrategyJson(pipelineJson, reservedKey);

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

const writeFile = ({
  body,
  path,
  pipelineUuid,
  projectUuid,
}: {
  body: string;
  path: string;
  pipelineUuid: string;
  projectUuid: string;
}) => {
  return fetcher(
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

export const GenerateParametersDialog = ({
  isOpen,
  onClose,
  pipelinePath,
  projectUuid,
  pipelineUuid,
  jobUuid,
  runUuid,
}: {
  isOpen: boolean;
  onClose: () => void;
  pipelinePath: string | undefined;
  projectUuid: string | undefined;
  pipelineUuid: string | undefined;
  jobUuid: string | undefined;
  runUuid: string | undefined;
}) => {
  const { pipelineJson, isFetchingPipelineJson } = useFetchPipelineJson({
    projectUuid,
    pipelineUuid,
  });

  const { setConfirm, setAlert } = useGlobalContext();
  const { reservedKey } = useParameterReservedKey();

  const [parameterFileString, setParameterFileString] = React.useState("");
  const parameterFileStringForValidation = useDebounce(
    parameterFileString,
    1000
  );
  const [copyButtonText, setCopyButtonText] = React.useState("Copy");

  React.useEffect(() => {
    setParameterFileString(pipelineJsonToParams(pipelineJson, reservedKey));
  }, [pipelineJson, reservedKey]);

  const copyParams = () => {
    copyToClipboard(pipelineJsonToParams(pipelineJson, reservedKey));
    setCopyButtonText("Copied!");
  };

  const onCreateFile = (filePath: string | undefined) => {
    if (!filePath || !pipelineUuid || !projectUuid) return;
    // Do not await this promise.
    // User will get alert if it fails afterwards.
    writeFile({
      body: parameterFileString,
      path: filePath,
      pipelineUuid,
      projectUuid,
    }).catch((error) => {
      setAlert(
        "Error",
        `Failed to create Parameter file. ${error.message || ""}`
      );
    });
    onClose();
  };

  const createParamFile = async () => {
    if (!isValidJson(parameterFileString)) {
      setAlert(
        "Invalid JSON",
        "Invalid JSON content. Please fix syntax errors before writing the file to disk."
      );
      return;
    }

    let filePath = pipelinePathToJsonLocation(pipelinePath ? pipelinePath : "");

    if (!projectUuid || !pipelineUuid || !filePath) {
      return;
    }

    // Check if file exists
    let doesFileExist: boolean;
    try {
      doesFileExist = await isValidFile({
        projectUuid,
        pipelineUuid,
        jobUuid,
        runUuid,
        path: filePath,
        allowedExtensions: ["json"],
        useProjectRoot: true,
      });
    } catch (error) {
      doesFileExist = false;
    }

    if (!doesFileExist) {
      onCreateFile(filePath);
      return;
    }

    setConfirm(
      "Warning",
      "This file already exists, do you want to overwrite it?",
      async (resolve) => {
        onCreateFile(filePath);
        resolve(true);
        return true;
      }
    );
  };

  const isParameterJsonValid = React.useMemo(() => {
    if (!parameterFileStringForValidation) return true;
    return isValidJson(parameterFileStringForValidation);
  }, [parameterFileStringForValidation]);

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{ sx: { overflowY: "visible" } }}
    >
      <form id="generate-parameters">
        <DialogTitle>Job parameters file</DialogTitle>
        <DialogContent sx={{ overflowY: "visible" }}>
          <Stack direction="column" spacing={2}>
            <Box>
              <p>
                The job parameters file can be used to set the parameter values
                for the pipeline runs in a job.
              </p>
            </Box>
            <Box>
              <p>
                A job parameters file placed in the same directory as the
                pipeline file will automatically be detected if named
                appropriately.
              </p>
            </Box>
            <Box>
              <p>
                <span>
                  The job parameters file path for this pipeline file is:{" "}
                </span>
                <Code>
                  {pipelinePathToJsonLocation(pipelinePath ? pipelinePath : "")}
                </Code>
              </p>
            </Box>
            {isFetchingPipelineJson && <LinearProgress />}
            {!isFetchingPipelineJson && (
              <>
                <CodeMirror
                  value={parameterFileString}
                  onBeforeChange={(editor, data, value) => {
                    setParameterFileString(value);
                  }}
                  options={{
                    mode: "application/json",
                    theme: "jupyter",
                    lineNumbers: true,
                  }}
                />
                {!isParameterJsonValid && (
                  <Alert
                    severity="warning"
                    sx={{ marginTop: (theme) => theme.spacing(2) }}
                  >
                    Your input is not valid JSON.
                  </Alert>
                )}
              </>
            )}
            <ParameterDocs />
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
