import { NewConnection } from "@/types";
import Box, { BoxProps } from "@mui/material/Box";
import { alpha } from "@mui/material/styles";
import classNames from "classnames";
import React from "react";
import { usePipelineRefs } from "./contexts/PipelineRefsContext";
import { usePipelineUiStateContext } from "./contexts/PipelineUiStateContext";
import { useFileManagerContext } from "./file-manager/FileManagerContext";

const DOT_SIZE = "10px";

type InnerDotProps = BoxProps & { active?: boolean };

const InnerDot = ({ active, sx, ...props }: InnerDotProps) => {
  return (
    <Box
      sx={{
        background: (theme) =>
          active ? theme.palette.primary.main : theme.palette.text.primary,
        borderRadius: DOT_SIZE,
        width: DOT_SIZE,
        height: DOT_SIZE,
        margin: (theme) => theme.spacing(1.25, 1.25),
        pointerEvents: "none",
        ...sx,
      }}
      {...props}
    />
  );
};

type DotType = BoxProps & {
  incoming?: boolean;
  outgoing?: boolean;
  newConnection: React.MutableRefObject<NewConnection | undefined>;
  disabled?: boolean;
  isReadOnly: boolean;
  active?: boolean;
  onMouseLeave?: (e: React.MouseEvent) => void;
  startCreateConnection?: () => void;
  endCreateConnection?: () => void;
};

export const ConnectionDot = React.forwardRef<HTMLElement, DotType>(
  function Dot(
    {
      incoming,
      outgoing,
      newConnection,
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
    },
    ref
  ) {
    const { keysDown } = usePipelineRefs();

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
      // user is panning the canvas
      if (keysDown.has("Space")) return;
      e.stopPropagation();
      e.preventDefault();
      if (onMouseOver) onMouseOver(e);

      const shouldShowHoverEffect =
        (newConnection.current && incoming) ||
        (!newConnection.current && outgoing);

      if (shouldShowHoverEffect) setIsHovering(true);
    };

    const onMouseDownContainer = (
      e: React.MouseEvent<HTMLDivElement, MouseEvent>
    ) => {
      // user is panning the canvas
      if (keysDown.has("Space")) return;
      e.stopPropagation();
      e.preventDefault();
      setIsMouseDown(true);
    };

    const { dragFile, resetMove } = useFileManagerContext();

    const { uiStateDispatch } = usePipelineUiStateContext();

    const onMouseUpContainer = (
      e: React.MouseEvent<HTMLDivElement, MouseEvent>
    ) => {
      // user is panning the canvas
      if (keysDown.has("Space")) return;
      e.stopPropagation();
      e.preventDefault();
      if (dragFile) resetMove();
      if (onMouseUp) onMouseUp(e);
      if (outgoing && newConnection.current) {
        uiStateDispatch({
          type: "REMOVE_CONNECTION",
          payload: newConnection.current,
        });
      }
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
      // user is panning the canvas
      if (keysDown.has("Space")) return;
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
  }
);
