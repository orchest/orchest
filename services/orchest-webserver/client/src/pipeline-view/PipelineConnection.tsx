import { Position } from "@/types";
import { globalMDCVars } from "@orchest/lib-utils";
import React from "react";

const THEME_SECONDARY = globalMDCVars()["mdcthemesecondary"];

// set SVG properties
const lineHeight = 2;
const svgPadding = 5;
const arrowWidth = 7;

const curvedHorizontal = function (
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  let line = [];
  let mx = x1 + (x2 - x1) / 2;

  line.push("M", x1, y1);
  line.push("C", mx, y1, mx, y2, x2, y2);

  return line.join(" ");
};

const PipelineConnection: React.FC<{
  startNodePosition: Position;
  endNodePosition: Position | null;
  startNodeUUID: string;
  endNodeUUID?: string;
  onClick: (e: MouseEvent, startNodeUUID: string, endNodeUUID: string) => void;
  xEnd: number;
  yEnd: number;
  selected: boolean;
}> = ({
  startNodePosition,
  endNodePosition,
  onClick,
  selected,
  startNodeUUID,
  endNodeUUID,
  ...props
}) => {
  const connectionHolder = React.useRef(null);

  // TODO: clean up
  const isDev =
    startNodeUUID.includes("106bb") && endNodeUUID.includes("ac578");

  const renderProperties = React.useMemo(() => {
    // 1. if endNodePosition is defined => a complete connection
    // 2. if props.xEnd is defined => user is still making the connection, not yet decided the endNode
    // 3. startNodePosition => default, just started to create
    let xEnd = endNodePosition
      ? endNodePosition.x
      : props.xEnd ?? startNodePosition.x; // props.xEnd could be 0, so we need to use ?? instead of ||

    let yEnd = endNodePosition
      ? endNodePosition.y
      : props.yEnd ?? startNodePosition.y;

    let targetX = xEnd - startNodePosition.x;
    let targetY = yEnd - startNodePosition.y;

    let xOffset = Math.min(targetX, 0);
    let yOffset = Math.min(targetY, 0);

    let styles = {
      transform:
        "translateX(" +
        (startNodePosition.x - svgPadding + xOffset) +
        "px) translateY(" +
        (startNodePosition.y - svgPadding + yOffset - lineHeight / 2) +
        "px)",
    };

    return { targetX, targetY, styles, xOffset, yOffset };
  }, [
    startNodePosition.x,
    startNodePosition.y,
    endNodePosition,
    props.xEnd,
    props.yEnd,
  ]);

  const onMouseDown = React.useCallback(
    (e) => {
      if (onClick) onClick(e, startNodeUUID, endNodeUUID);
    },
    [onClick, startNodeUUID, endNodeUUID]
  );

  // render SVG
  React.useEffect(() => {
    // startNode is required
    if (connectionHolder.current && renderProperties) {
      const { styles, targetX, targetY, xOffset, yOffset } = renderProperties;
      // initialize SVG
      let svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      let svgPath = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );
      svgPath.setAttribute("stroke", "black");
      svgPath.setAttribute("stroke-width", "2");
      svgPath.setAttribute("fill", "none");
      svgPath.setAttribute("id", "path");

      let svgPathClickable = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );
      svgPathClickable.setAttribute("stroke", "transparent");
      svgPathClickable.setAttribute("stroke-width", "16");
      svgPathClickable.setAttribute("fill", "none");
      svgPathClickable.setAttribute("id", "path-clickable");

      svgPathClickable.onmousedown = onMouseDown;
      svgEl.appendChild(svgPath);
      svgEl.appendChild(svgPathClickable);

      // update svg poly line
      svgEl.setAttribute("width", Math.abs(targetX) + 2 * svgPadding + "px");
      svgEl.setAttribute("height", Math.abs(targetY) + 2 * svgPadding + "px");

      svgPath.setAttribute(
        "d",
        curvedHorizontal(
          svgPadding - xOffset,
          svgPadding - yOffset,
          svgPadding + targetX - xOffset - arrowWidth,
          svgPadding + targetY - yOffset
        )
      );
      svgPathClickable.setAttribute("d", svgPath.getAttribute("d"));

      if (selected) {
        svgPath.setAttribute("stroke", THEME_SECONDARY);
        svgPath.setAttribute("stroke-width", "3");
      } else {
        svgPath.setAttribute("stroke", "black");
        svgPath.setAttribute("stroke-width", "2");
      }

      const classes = [
        "connection",
        targetX < arrowWidth * 10 && "flipped-horizontal",
        targetY < 0 && "flipped",
        selected && "selected",
      ].filter(Boolean);

      connectionHolder.current.className = "";
      connectionHolder.current.classList.add(...classes);
      Object.assign(connectionHolder.current.style, styles);
      connectionHolder.current.replaceChildren(svgEl);
    }
  }, [renderProperties, selected, onMouseDown]);

  return (
    <div
      data-start-uuid={startNodeUUID}
      data-end-uuid={endNodeUUID}
      ref={connectionHolder}
    ></div>
  );
};

export default PipelineConnection;
