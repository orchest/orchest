import { SxProps, Theme } from "@mui/material";
import Stack, { StackProps } from "@mui/material/Stack";
import React from "react";
import { SCROLL_PANE_CLASS } from "./ScrollPane";

const baseSx: SxProps<Theme> = {
  backgroundColor: (theme) => theme.palette.background.paper,
  transition: "box-shadow 200ms ease-out",
};

/**
 * A header that sticks to the top of the page.
 * If the header is within the `ScrollPane` component,
 * it gets a shadow below it when the pane is scrolled.
 */
export const StickyHeader = ({ sx, ...props }: StackProps) => {
  const [contentPane, setContentPane] = React.useState<HTMLElement>();
  const [scrolled, setScrolled] = React.useState(false);

  const findContentPaneParent = React.useCallback(
    (header: HTMLDivElement) => setContentPane(findScrollPane(header)),
    []
  );

  React.useEffect(() => {
    const onScroll = () => setScrolled((contentPane?.scrollTop ?? 0) > 5);

    contentPane?.addEventListener("scroll", onScroll);

    return () => contentPane?.removeEventListener("scroll", onScroll);
  }, [contentPane]);

  return (
    <Stack
      {...props}
      ref={findContentPaneParent}
      top={0}
      paddingTop={4}
      paddingBottom={2}
      position="sticky"
      width="100%"
      marginBottom={4}
      sx={{
        ...baseSx,
        ...sx,
        boxShadow: scrolled ? "0 0 12px rgba(0, 0, 0, 0.15)" : undefined,
      }}
    />
  );
};

const findScrollPane = (element: HTMLElement | undefined | null) => {
  if (element?.parentElement?.classList.contains(SCROLL_PANE_CLASS)) {
    return element.parentElement;
  } else if (element?.parentElement) {
    return findScrollPane(element.parentElement);
  }
};
