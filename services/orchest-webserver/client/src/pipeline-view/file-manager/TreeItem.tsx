import { OrchestFileIcon } from "@/components/common/icons/OrchestFileIcon";
import MuiTreeItem, { treeItemClasses, TreeItemProps } from "@mui/lab/TreeItem";
import Box from "@mui/material/Box";
import { styled } from "@mui/material/styles";
import React from "react";
import { getIcon, SVGFileIcon } from "./SVGFileIcon";

const StyledTreeItemRoot = styled(MuiTreeItem)(({ theme }) => ({
  [`& .${treeItemClasses.content}`]: {
    padding: theme.spacing(0, 0.5),
    [`.${treeItemClasses.label}`]: {
      paddingLeft: 0,
      ["div"]: {
        textOverflow: "ellipsis",
        overflow: "hidden",
      },
    },
    "&.Mui-focused, &.Mui-selected, &.Mui-selected.Mui-focused": {
      backgroundColor: theme.palette.grey[100],
      color: theme.palette.primary.main,
    },
  },
}));

export function TreeItem({
  fileName,
  path,
  labelText,
  setIsDragging,
  setDragItem,
  ...other
}: TreeItemProps & {
  fileName?: string;
  labelText: string;
  setIsDragging: (value: boolean) => void;
  setDragItem: (dragItemData: { labelText: string; path: string }) => void;
  path: string;
  style: React.CSSProperties;
}) {
  const icon = !fileName ? undefined : fileName.endsWith(".orchest") ? (
    <OrchestFileIcon size={22} />
  ) : (
    getIcon(fileName)
  );

  const DRAG_THRESHOLD = 5;

  const [pressed, setPressed] = React.useState(false);
  const [triggeredDragging, setTriggedDragging] = React.useState(false);
  const cumulativeDrag = React.useRef({ drag: 0 });

  const cancelMove = () => {
    setPressed(false);
    setTriggedDragging(false);
    cumulativeDrag.current.drag = 0;
  };

  return (
    <StyledTreeItemRoot
      onMouseDown={() => {
        setPressed(true);
      }}
      onMouseMove={(e) => {
        if (pressed && !triggeredDragging) {
          const normalizedDeltaX = e.movementX / window.devicePixelRatio;
          const normalizedDeltaY = e.movementY / window.devicePixelRatio;
          cumulativeDrag.current.drag +=
            Math.abs(normalizedDeltaX) + Math.abs(normalizedDeltaY);

          if (cumulativeDrag.current.drag > DRAG_THRESHOLD) {
            setIsDragging(true);
            setDragItem({ labelText, path });
            setTriggedDragging(true);
          }
        }
      }}
      onMouseUp={() => {
        cancelMove();
      }}
      onMouseLeave={() => {
        cancelMove();
      }}
      label={
        <Box sx={{ fontSize: (theme) => theme.typography.body2.fontSize }}>
          {fileName && (
            <div
              style={{
                position: "absolute",
                overflow: "hidden",
                height: "20px",
                left: "-22px",
                top: "0px",
              }}
            >
              <SVGFileIcon icon={icon} />
            </div>
          )}
          {labelText}
        </Box>
      }
      {...other}
    />
  );
}
