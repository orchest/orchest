import Stack, { StackProps } from "@mui/material/Stack";
import React from "react";
import { CenteredStack } from "./CenteredStack";
import { Layout } from "./Layout";
import { MainSidePanel } from "./MainSidePanel";
import { ScrollPane } from "./ScrollPane";
import { StickyHeader, StickyHeaderProps } from "./StickyHeader";

export type ViewLayoutProps = StackProps & {
  /** A side panel that will be rendered to the left of the main content (children). */
  sidePanel?: React.ReactNode;
  /** A sticky header that floats above the main content (children). */
  header?: StickyHeaderProps["children"];
  /**  */
  fixedWidth?: boolean;
};

/**
 * Provides the share base layout for many views.
 * This components adds the main menus and toolbars around the view (from `Layout`).
 *
 * For convenience you may specify a (sticky) `header` and a `sidePanel`
 * which is used in many views.
 */
export const ViewLayout = React.forwardRef<HTMLDivElement, ViewLayoutProps>(
  function ViewLayout(
    { sidePanel, header, fixedWidth = true, children, ...props },
    ref
  ) {
    return (
      <Layout disablePadding>
        <Stack {...props} ref={ref} direction="row" width="100%" height="100%">
          {sidePanel && <MainSidePanel>{sidePanel}</MainSidePanel>}
          <ScrollPane>
            {header && (
              <StickyHeader zIndex={2}>
                {(state) => <CenteredStack>{header(state)}</CenteredStack>}
              </StickyHeader>
            )}
            {fixedWidth ? <CenteredStack>{children}</CenteredStack> : children}
          </ScrollPane>
        </Stack>
      </Layout>
    );
  }
);
