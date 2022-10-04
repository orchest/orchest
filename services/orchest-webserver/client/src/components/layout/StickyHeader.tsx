import { alpha, SxProps, Theme } from "@mui/material";
import Stack, { StackProps } from "@mui/material/Stack";
import React from "react";
import { SCROLL_PANE_CLASS } from "./ScrollPane";

const baseSx: SxProps<Theme> = {
  backgroundColor: (theme) => theme.palette.background.paper,
};

const scrolledSx: SxProps<Theme> = {
  backgroundColor: (theme) => alpha(theme.palette.background.paper, 0.8),
  backdropFilter: "blur(8px)",
  boxShadow: "0 0 12px rgba(0, 0, 0, 0.1)",
};

export type StickyHeaderState = { scrolled: boolean };

export type StickyHeaderProps = Omit<StackProps, "children"> & {
  children: (state: StickyHeaderState) => React.ReactNode;
};

/**
 * A header that sticks to the top of the page.
 * If the header is within the `ScrollPane` component,
 * it gets a shadow below it when the pane is scrolled.
 */
export const StickyHeader = ({ sx, children, ...props }: StickyHeaderProps) => {
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

  const combinedSx = React.useMemo(
    () =>
      scrolled ? { ...baseSx, ...scrolledSx, ...sx } : { ...baseSx, ...sx },
    [scrolled, sx]
  );

  const state = React.useMemo(() => ({ scrolled }), [scrolled]);

  return (
    <Stack
      {...props}
      ref={findContentPaneParent}
      top={0}
      paddingTop={4}
      position="sticky"
      width="100%"
      marginBottom={4}
      sx={combinedSx}
    >
      {children(state)}
    </Stack>
  );
};

const findScrollPane = (element: HTMLElement | undefined | null) => {
  if (element?.parentElement?.classList.contains(SCROLL_PANE_CLASS)) {
    return element.parentElement;
  } else if (element?.parentElement) {
    return findScrollPane(element.parentElement);
  }
};
