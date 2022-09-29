import Stack, { StackProps } from "@mui/material/Stack";
import React from "react";
import { CenteredStack } from "./CenteredStack";
import { Layout } from "./Layout";
import { MainContainer } from "./MainContainer";
import { MainSidePanel } from "./MainSidePanel";
import { StickyHeader } from "./StickyHeader";

export type LayoutWithSidePanelProps = StackProps & {
  /** A side panel that will be rendered to the left of the main content (children). */
  sidePanel?: React.ReactNode;
  /** A sticky header that floats above the main content (children). */
  header?: React.ReactNode;
};

/**
 * Provides the share base layout for many views.
 * This components adds the main menus and toolbars around the view (from `Layout`).
 *
 * For convenience you may specify a (sticky) `header` and a `sidePanel`
 * which is used in many views.
 */
export const LayoutWithSidePanel = React.forwardRef<
  HTMLDivElement,
  LayoutWithSidePanelProps
>(function LayoutWithSidePanel({ sidePanel, header, children, ...props }, ref) {
  return (
    <Layout disablePadding>
      <Stack {...props} ref={ref} direction="row" width="100%" height="100%">
        {sidePanel && <MainSidePanel>{sidePanel}</MainSidePanel>}

        <MainContainer>
          {header && (
            <StickyHeader zIndex={2}>
              <CenteredStack>{header}</CenteredStack>
            </StickyHeader>
          )}

          <CenteredStack>{children}</CenteredStack>
        </MainContainer>
      </Stack>
    </Layout>
  );
});
