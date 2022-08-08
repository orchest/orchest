import { StackProps } from "@mui/material/Stack";
import React from "react";
import { ViewportCenterMessage } from "./components/ViewportCenterMessage";

export const NoStep = (props: StackProps) => {
  return (
    <ViewportCenterMessage
      imgSrc="/image/no-step.svg"
      title="No Pipeline steps"
      description={`A Pipeline Step is an executable file running in its own isolated 
      environment. Drag & drop files from the file manager to get started.`}
      docPath="/fundamentals/pipelines.html"
      {...props}
    />
  );
};
