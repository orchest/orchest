import Box, { BoxProps } from "@mui/material/Box";
import { alpha, styled } from "@mui/material/styles";
import classNames from "classnames";
import React from "react";

const DOT_SIZE = "10px";

const InnerDot = styled(Box)<{ active?: boolean }>(({ theme, active }) => ({
  background: active ? theme.palette.primary.main : theme.palette.common.black,
  borderRadius: DOT_SIZE,
  width: DOT_SIZE,
  height: DOT_SIZE,
  margin: theme.spacing(1.25, 1.25),
  pointerEvents: "none",
}));

type DotType = BoxProps & {
  incoming?: boolean;
  outgoing?: boolean;
  shouldShowHoverEffect: boolean;
  disabled?: boolean;
  isReadOnly: boolean;
  active?: boolean;
  onMouseLeave?: (e: React.MouseEvent) => void;
  startCreateConnection?: () => void;
  endCreateConnection?: () => void;
};

export const ConnectionDot = React.forwardRef(function Dot(
  {
    incoming,
    outgoing,
    shouldShowHoverEffect,
    active,
    className,
    disabled,
    isReadOnly,
    onMouseUp,
    onMouseOver,
    onMouseLeave,
    startCreateConnection,
    endCreateConnection,
    sx,
    ...props
  }: DotType,
  ref: React.MutableRefObject<Extract<BoxProps, "ref">>
) {
  const typeClassName = incoming
    ? "incoming-connections"
    : outgoing
    ? "outgoing-connections"
    : "";

  const [isHovering, setIsHovering] = React.useState(false);
  const [isMouseDown, setIsMouseDown] = React.useState(false);

  const onMouseOverContainer = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => {
    e.stopPropagation();
    e.preventDefault();
    if (onMouseOver) onMouseOver(e);
    if (shouldShowHoverEffect) setIsHovering(true);
  };

  const onMouseDownContainer = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setIsMouseDown(true);
  };

  const onMouseUpContainer = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => {
    e.stopPropagation();
    e.preventDefault();
    if (onMouseUp) onMouseUp(e);
    if (
      e.button === 0 &&
      incoming &&
      !outgoing &&
      !isMouseDown && // because user drag the connection line into this dot, onMouseUp was not triggered in the first place
      endCreateConnection
    )
      endCreateConnection();
    setIsMouseDown(false);
  };

  const onMouseLeaveContainer = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => {
    e.stopPropagation();
    e.preventDefault();
    // user is trying to create a new connection
    if (onMouseLeave) onMouseLeave(e);
    if (
      e.button === 0 &&
      !incoming &&
      outgoing &&
      isMouseDown &&
      startCreateConnection
    )
      startCreateConnection();
    setIsMouseDown(false);
    setIsHovering(false);
  };

  return (
    <Box
      ref={ref}
      className={classNames(typeClassName, className, "connection-point")}
      sx={sx}
      onMouseOver={onMouseOverContainer}
      onMouseUp={onMouseUpContainer}
      onMouseLeave={onMouseLeaveContainer}
      onMouseDown={onMouseDownContainer}
      {...props}
    >
      <InnerDot active={active} />
      <Box
        sx={{
          position: "absolute",
          width: 24,
          height: 24,
          top: 3,
          left: 3,
          borderRadius: "100%",
          backgroundColor: (theme) =>
            isHovering && !isReadOnly
              ? alpha(
                  !disabled
                    ? theme.palette.primary.main
                    : theme.palette.error.light,
                  0.2
                )
              : "transparent",
        }}
      ></Box>
    </Box>
  );
});
