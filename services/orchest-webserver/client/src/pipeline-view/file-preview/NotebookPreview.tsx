import { FileDescription } from "@/api/file-viewer/fileViewerApi";
import { styled } from "@mui/material/styles";
import React from "react";

export type NotebookPreviewProps = {
  file: FileDescription;
};

const NotebookIframe = styled("iframe")({
  border: "none",
  width: "100%",
  height: "100%",
});

export function NotebookPreview({ file }: NotebookPreviewProps) {
  return <NotebookIframe srcDoc={file.content} />;
}
