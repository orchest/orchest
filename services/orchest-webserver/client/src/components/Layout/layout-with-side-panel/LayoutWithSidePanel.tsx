import Stack from "@mui/material/Stack";
import React from "react";
import { Layout } from "../Layout";
import { MainContainer, MainContainerProps } from "./MainContainer";
import { MainSidePanel } from "./MainSidePanel";

type LayoutWithSidePanelProps = {
  sidePanel: React.ReactNode;
  children: React.ReactNode;
  mainContainerProps?: MainContainerProps;
};

export const LayoutWithSidePanel = ({
  sidePanel,
  children,
  mainContainerProps,
}: LayoutWithSidePanelProps) => {
  return (
    <Layout disablePadding>
      <Stack direction="row" sx={{ height: "100%", width: "100%" }}>
        <MainSidePanel>{sidePanel}</MainSidePanel>
        <MainContainer {...mainContainerProps}>{children}</MainContainer>
      </Stack>
    </Layout>
  );
};
