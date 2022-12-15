import { styled } from "@mui/material/styles";
import React from "react";

export type NotebookPreviewProps = {
  content: string;
};

const NotebookIframe = styled("iframe")({
  border: "none",
  width: "100%",
  height: "100%",
});

export function NotebookPreview({ content }: NotebookPreviewProps) {
  return <NotebookIframe srcDoc={content} />;
}
