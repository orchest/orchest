import Stack from "@mui/material/Stack";
import React from "react";
import { Layout } from "../Layout";
import { MainContainer } from "./MainContainer";
import { MainSidePanel } from "./MainSidePanel";

type LayoutWithSidePanelProps = {
  sidePanel: React.ReactNode;
  children: React.ReactNode;
};

export const LayoutWithSidePanel = ({
  sidePanel,
  children,
}: LayoutWithSidePanelProps) => {
  return (
    <Layout disablePadding>
      <Stack direction="row" sx={{ height: "100%", width: "100%" }}>
        <MainSidePanel>{sidePanel}</MainSidePanel>
        <MainContainer>{children}</MainContainer>
      </Stack>
    </Layout>
  );
};
