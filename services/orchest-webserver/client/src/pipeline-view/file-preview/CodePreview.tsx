import { FileDescription } from "@/api/file-viewer/fileViewerApi";
import { SnackBar } from "@/components/common/SnackBar";
import { RouteLink } from "@/components/RouteLink";
import { useActiveStep } from "@/hooks/useActiveStep";
import { Button } from "@mui/material";
import Box from "@mui/material/Box";
import blue from "@mui/material/colors/blue";
import Stack from "@mui/material/Stack";
import "codemirror/mode/python/python";
import "codemirror/mode/r/r";
import "codemirror/mode/shell/shell";
import React from "react";
import { Controlled as CodeMirror } from "react-codemirror2";
import { useJupyterLabLink } from "../hooks/useJupyterLabLink";

const MODE_MAPPING = {
  py: "text/x-python",
  sh: "text/x-sh",
  r: "text/x-rsrc",
  default: "text/plain",
} as const;

export interface CodePreviewProps {
  file: FileDescription;
}

export function CodePreview({ file }: CodePreviewProps) {
  const [showMessage, setShowMessage] = React.useState(false);
  const activeStep = useActiveStep();
  const jupyterLabLink = useJupyterLabLink(activeStep);

  React.useEffect(() => {
    if (!showMessage) return;

    const handle = window.setTimeout(() => setShowMessage(false), 7500);

    return () => window.clearTimeout(handle);
  }, [showMessage]);

  return (
    <Box
      height="100%"
      flex="1"
      sx={{ ".react-codemirror2, .CodeMirror": { height: "100%" } }}
    >
      <CodeMirror
        value={file.content}
        onBeforeChange={() => undefined}
        onKeyPress={() => setShowMessage(true)}
        options={{
          mode: MODE_MAPPING[file?.ext.toLowerCase() ?? "default"],
          theme: "jupyter",
          lineNumbers: true,
          readOnly: true,
        }}
      />
      <SnackBar
        open={showMessage}
        action={
          <Button
            LinkComponent={RouteLink}
            size="small"
            href={jupyterLabLink}
            sx={{ color: blue[200] }}
          >
            Edit in JupyterLab
          </Button>
        }
        message={
          <Stack direction="row" spacing={2} alignItems="center">
            <Box>File preview is read-only</Box>
          </Stack>
        }
      />
    </Box>
  );
}
