import { Code } from "@/components/common/Code";
import { OrchestFileIcon } from "@/components/common/icons/OrchestFileIcon";
import { useAppContext } from "@/contexts/AppContext";
import { useSessionsContext } from "@/contexts/SessionsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import MuiTreeItem, { treeItemClasses, TreeItemProps } from "@mui/lab/TreeItem";
import { SxProps, Theme } from "@mui/material";
import Box from "@mui/material/Box";
import { styled } from "@mui/material/styles";
import React from "react";
import { useFileManagerContext } from "./FileManagerContext";
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
  disableDragging,
  fileName = "",
  path = "",
  labelText,
  onContextMenu,
  ...other
}: TreeItemProps & {
  disableDragging?: boolean;
  fileName?: string;
  path?: string;
  labelText: string;
  sx: SxProps<Theme>;
}) => {
  const {
    setSelectedFiles,
    setIsDragging,
    setDragFile,
  } = useFileManagerContext();
  const { pipelineUuid, projectUuid } = useCustomRoute();
  const { setConfirm } = useAppContext();
  const { getSession, toggleSession } = useSessionsContext();

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

  return (
    <StyledTreeItemRoot
      onMouseDown={() => {
        if (!disableDragging) setPressed(true);
      }}
      onMouseMove={(e) => {
        if (!disableDragging && pressed && !triggeredDragging) {
          const normalizedDeltaX = e.movementX / window.devicePixelRatio;
          const normalizedDeltaY = e.movementY / window.devicePixelRatio;
          cumulativeDrag.current.drag +=
            Math.abs(normalizedDeltaX) + Math.abs(normalizedDeltaY);

          if (cumulativeDrag.current.drag > DRAG_THRESHOLD) {
            const session = getSession({
              pipelineUuid,
              projectUuid,
            });
            if (path.endsWith(".orchest") && session) {
              setConfirm(
                "Warning",
                <>
                  Before moving <Code>.orchest</Code> files, you need to stop
                  session. Do you want to continue?
                </>,
                {
                  confirmLabel: "Stop session",
                  onConfirm: async (resolve) => {
                    toggleSession({ pipelineUuid, projectUuid });
                    resolve(true);
                    return true;
                  },
                }
              );
              return;
            }
            setIsDragging(true);
            setDragFile({ labelText, path });
            setSelectedFiles((current) => [...current, path]);
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
