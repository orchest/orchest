import { ViewportCenterMessage } from "@/pipeline-view/pipeline-viewport/components/ViewportCenterMessage";
import { StackProps } from "@mui/material/Stack";
import React from "react";

export const NoEnvironment = (props: StackProps) => {
  return (
    <ViewportCenterMessage
      imgSrc="/image/no-step.svg" // TODO: change it to the right svg
      title="No Environments"
      description={`Environments define the conditions in which Pipeline steps execute scripts and kernels.`}
      {...props}
    />
  );
};
