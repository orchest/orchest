import { FileDescription } from "@/api/file-viewer/fileViewerApi";
import Box from "@mui/material/Box";
import "codemirror/mode/python/python";
import "codemirror/mode/r/r";
import "codemirror/mode/shell/shell";
import React from "react";
import { Controlled as CodeMirror } from "react-codemirror2";

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
  return (
    <Box
      height="100%"
      flex="1"
      sx={{ ".react-codemirror2, .CodeMirror": { height: "100%" } }}
    >
      <CodeMirror
        value={file.content}
        onBeforeChange={() => undefined}
        options={{
          mode: MODE_MAPPING[file?.ext.toLowerCase() ?? "default"],
          theme: "jupyter",
          lineNumbers: true,
          readOnly: true,
        }}
      />
    </Box>
  );
}
