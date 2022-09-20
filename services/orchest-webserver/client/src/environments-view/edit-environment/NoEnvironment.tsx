import { ViewportCenterMessage } from "@/pipeline-view/pipeline-viewport/components/ViewportCenterMessage";
import Stack, { StackProps } from "@mui/material/Stack";
import React from "react";

export const NoEnvironment = (props: StackProps) => {
  return (
    <Stack justifyContent="center" alignItems="center" sx={{ height: "100%" }}>
      <ViewportCenterMessage
        imgSrc="/image/no-environment.svg"
        title="No Environments"
        description={`Environments define the conditions in which Pipeline steps execute scripts and kernels.`}
        docPath="/fundamentals/environments.html"
        {...props}
      />
    </Stack>
  );
};
