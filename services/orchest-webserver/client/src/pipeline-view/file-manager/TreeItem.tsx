import { OrchestFileIcon } from "@/components/common/icons/OrchestFileIcon";
import MuiTreeItem, { treeItemClasses, TreeItemProps } from "@mui/lab/TreeItem";
import { SxProps, Theme } from "@mui/material";
import Box from "@mui/material/Box";
import { styled } from "@mui/material/styles";
import { hasValue } from "@orchest/lib-utils";
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

const DRAG_THRESHOLD = 3;

export const TreeItem = ({
  fileName = "",
  path = "",
  labelText,
  setIsDragging,
  setDragFile,
  onContextMenu,
  ...other
}: TreeItemProps & {
  fileName?: string;
  path?: string;
  labelText: string;
  setIsDragging?: (value: boolean) => void;
  setDragFile?: (dragItemData: { labelText: string; path: string }) => void;
  sx: SxProps<Theme>;
}) => {
  const icon = !fileName ? undefined : fileName.endsWith(".orchest") ? (
    <OrchestFileIcon size={22} />
  ) : (
    getIcon(fileName)
  );

  const [pressed, setPressed] = React.useState(false);
  const [triggeredDragging, setTriggedDragging] = React.useState(false);
  const cumulativeDrag = React.useRef({ drag: 0 });

  const cancelMove = () => {
    setPressed(false);
    setTriggedDragging(false);
    cumulativeDrag.current.drag = 0;
  };

  const isDraggable = hasValue(setIsDragging) && hasValue(setDragFile);

  return (
    <StyledTreeItemRoot
      onMouseDown={() => {
        if (isDraggable) setPressed(true);
      }}
      onMouseMove={(e) => {
        if (isDraggable && pressed && !triggeredDragging) {
          const normalizedDeltaX = e.movementX / window.devicePixelRatio;
          const normalizedDeltaY = e.movementY / window.devicePixelRatio;
          cumulativeDrag.current.drag +=
            Math.abs(normalizedDeltaX) + Math.abs(normalizedDeltaY);

          if (cumulativeDrag.current.drag > DRAG_THRESHOLD) {
            if (setIsDragging) setIsDragging(true);
            if (setDragFile) setDragFile({ labelText, path });
            setTriggedDragging(true);
          }
        }
      }}
      onMouseUp={cancelMove}
      onMouseLeave={cancelMove}
      onContextMenu={onContextMenu}
      label={
        <Box sx={{ fontSize: (theme) => theme.typography.body2.fontSize }}>
          {fileName && (
            <Box
              sx={{
                position: "absolute",
                overflow: "hidden",
                height: (theme) => theme.spacing(2.5),
                left: (theme) => theme.spacing(-2.75),
                top: 0,
              }}
            >
              <SVGFileIcon icon={icon} />
            </Box>
          )}
          {labelText}
        </Box>
      }
      {...other}
    />
  );
};
