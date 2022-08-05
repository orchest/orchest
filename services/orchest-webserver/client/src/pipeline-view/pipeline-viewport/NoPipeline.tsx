import { StackProps } from "@mui/material/Stack";
import React from "react";
import { ViewportCenterMessage } from "./ViewportCenterMessage";

export const NoPipeline = (props: StackProps) => {
  return (
    <ViewportCenterMessage
      imgSrc="/image/no-pipeline.svg"
      title="No Pipelines in Project"
      description="Pipelines are an interactive tool for creating and experimenting with
    your data workflow. They are made up of steps and connections."
      {...props}
    />
  );
};
