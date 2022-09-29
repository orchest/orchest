import { SxProps, Theme } from "@mui/material";
import Stack, { StackProps } from "@mui/material/Stack";
import React from "react";
import { MAIN_CONTAINER_CLASS } from "./MainContainer";

const baseSx: SxProps<Theme> = {
  backgroundColor: (theme) => theme.palette.background.paper,
  transition: "box-shadow 320ms ease-in",
};

export const StickyHeader = ({ sx, ...props }: StackProps) => {
  const [contentPane, setContentPane] = React.useState<HTMLElement>();
  const [scrolled, setScrolled] = React.useState(false);

  const findContentPaneParent = React.useCallback(
    (header: HTMLDivElement) => setContentPane(findContentPane(header)),
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
        boxShadow: (theme) => (scrolled ? theme.shadows[1] : undefined),
      }}
    />
  );
};

const findContentPane = (element: HTMLElement | undefined | null) => {
  if (element?.parentElement?.classList.contains(MAIN_CONTAINER_CLASS)) {
    return element.parentElement;
  } else if (element?.parentElement) {
    return findContentPane(element.parentElement);
  }
};
