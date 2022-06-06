import { Code } from "@/components/common/Code";
import { useAppContext } from "@/contexts/AppContext";
import { useFetchPipelineJson } from "@/hooks/useFetchPipelineJson";
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
import { Alert, AlertDescription, Link } from "@orchest/design-system";
import React from "react";
import { Controlled as CodeMirror } from "react-codemirror2";

export const ParameterDocs = () => {
  return (
    <Alert status="info">
      <AlertDescription>
        <>
          <Link
            target="_blank"
            href="https://docs.orchest.io/en/stable/fundamentals/jobs.html#parametrizing-pipelines-and-steps"
          >
            Learn more
          </Link>{" "}
          about parametrizing your pipelines and steps.
        </>
      </AlertDescription>
    </Alert>
  );
};

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

  const { config } = useAppContext();

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
              Place the pipeline parameter file in the following location:{" "}
              <br />{" "}
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
            <ParameterDocs />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="secondary" onClick={onClose}>
            Close
          </Button>
          <Button variant="contained" onClick={copyParams}>
            {copyButtonText}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
