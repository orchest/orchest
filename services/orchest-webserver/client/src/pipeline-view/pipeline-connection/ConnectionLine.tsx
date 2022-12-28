import theme from "@/theme";
import Box, { BoxProps } from "@mui/material/Box";
import React from "react";

const pathStyle: React.CSSProperties = {
  cursor: "pointer",
  pointerEvents: "all",
};

const ConnectionLineSvg = ({
  onClick,
  selected,
  width,
  height,
  d,
}: React.SVGProps<SVGPathElement> & {
  selected?: boolean;
}) => {
  return (
    <svg
      width={width}
      height={height}
      style={{ float: "left", pointerEvents: "none" }}
    >
      <path
        id="path"
        stroke={
          selected ? theme.palette.primary.main : theme.palette.text.primary
        }
        strokeWidth={selected ? 3 : 2}
        fill="none"
        d={d}
        style={pathStyle}
      />
      <path
        id="path-clickable"
        onClick={onClick}
        stroke="transparent"
        strokeWidth={4}
        fill="none"
        d={d}
        style={pathStyle}
      />
    </svg>
  );
};

type SvgProps = Pick<React.SVGProps<SVGPathElement>, "width" | "height" | "d">;

type ConnectionLineProps = SvgProps &
  BoxProps & {
    startNodeUuid: string;
    endNodeUuid: string | undefined;
    selected: boolean;
    onClick?: React.MouseEventHandler<SVGPathElement> | undefined;
  };

export const ConnectionLine = React.forwardRef<
  HTMLDivElement,
  ConnectionLineProps
>(function ConnectionLine(
  {
    startNodeUuid,
    endNodeUuid,
    selected,
    onClick,
    width,
    height,
    d,
    sx,
    ...props
  }: ConnectionLineProps,
  ref
) {
  return (
    <Box
      data-start-uuid={startNodeUuid}
      data-end-uuid={endNodeUuid}
      ref={ref}
      sx={{
        position: "absolute",
        left: 0,
        top: 0,
        zIndex: 1,
        pointerEvents: "none",
        "&:after": {
          position: "absolute",
          content: '" "',
          display: "block",
          width: "12px",
          height: "12px",
          backgroundImage: selected
            ? 'url("/image/arrow-head-blue.svg")'
            : 'url("/image/arrow-head.svg")',
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
          right: "7px",
          bottom: "-1px",
          transition: "0s opacity ease",
          ...(sx as any), // eslint-disable-line @typescript-eslint/no-explicit-any
        },
      }}
      {...props}
    >
      <ConnectionLineSvg
        selected={selected}
        onClick={onClick}
        width={width}
        height={height}
        d={d}
      />
    </Box>
  );
});
