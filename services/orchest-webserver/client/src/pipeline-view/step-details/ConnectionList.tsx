import { SortableStack } from "@/components/SortableStack";
import { Connection, StepState } from "@/types";
import { ellipsis } from "@/utils/styles";
import AddOutlined from "@mui/icons-material/AddOutlined";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import DragHandleOutlined from "@mui/icons-material/DragHandleOutlined";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import React from "react";
import { createsLoop } from "../common";
import { usePipelineUiStateContext } from "../contexts/PipelineUiStateContext";
import { StepConnection } from "./StepDetailsContext";

export type ConnectionListProps = {
  hint?: string;
  sortable: boolean;
  direction: "incoming" | "outgoing";
  connections: readonly StepConnection[];
  onRemove(uuid: string): void;
  onSwap?(oldIndex: number, newIndex: number): void;
};

export const ConnectionList = ({
  hint,
  connections,
  direction,
  sortable,
  onRemove,
  onSwap = () => undefined,
}: ConnectionListProps) => {
  const [menuAnchor, setMenuAnchor] = React.useState<Element>();
  const { uiState, uiStateDispatch } = usePipelineUiStateContext();

  const canConnect = React.useCallback(
    (step: StepState) =>
      // It's not the currently selected step:
      step.uuid !== uiState.openedStep &&
      // None of the connections match this step:
      !connections.some(({ targetUuid }) => step.uuid === targetUuid) &&
      // The new connection will not create a loop:
      uiState.openedStep &&
      !createsLoop(
        uiState.steps,
        direction === "outgoing"
          ? [uiState.openedStep, step.uuid]
          : [step.uuid, uiState.openedStep]
      ),
    [connections, direction, uiState.openedStep, uiState.steps]
  );

  const availableSteps = React.useMemo(
    () => Object.values(uiState.steps).filter(canConnect),
    [uiState.steps, canConnect]
  );

  const connect = React.useCallback(
    (uuid: string) => {
      if (!uiState.openedStep) return;

      const payload: Required<Connection> =
        direction === "incoming"
          ? { startNodeUUID: uuid, endNodeUUID: uiState.openedStep }
          : { startNodeUUID: uiState.openedStep, endNodeUUID: uuid };

      uiStateDispatch({ type: "CONNECT", payload });
    },
    [direction, uiState.openedStep, uiStateDispatch]
  );

  return (
    <Box>
      <Stack direction="row" alignItems="center" position="relative" gap={1.5}>
        <Typography
          component="div"
          variant="subtitle2"
          fontSize="14px"
          color="text.secondary"
          sx={{ textTransform: "capitalize" }}
        >
          {direction}
        </Typography>
        {hint && (
          <Tooltip title={hint} placement="left-end" arrow>
            <InfoOutlined
              color="primary"
              style={{ width: "24px", height: "24px" }}
            />
          </Tooltip>
        )}
        <IconButton
          sx={{ marginLeft: "auto" }}
          disabled={availableSteps.length === 0}
          onClick={(event) => setMenuAnchor(event.target as Element)}
        >
          <AddOutlined
            color="primary"
            style={{ width: "20px", height: "20px" }}
          />
        </IconButton>
        <Menu
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(undefined)}
          anchorEl={menuAnchor}
        >
          {availableSteps.map(({ title, uuid }) => (
            <MenuItem onClick={() => connect(uuid)} key={uuid}>
              {title}
            </MenuItem>
          ))}
        </Menu>
      </Stack>
      <SortableStack
        disabled={!sortable}
        onUpdate={async (oldIndex, newIndex) => onSwap(oldIndex, newIndex)}
      >
        {connections.map(({ targetUuid, title, filePath }) => (
          <Stack
            flexDirection="row"
            key={targetUuid}
            alignItems="center"
            justifyContent="space-between"
            sx={{ width: "100%" }}
          >
            <Stack flexShrink={1} flexDirection="row" gap={1.5} minWidth="0">
              {sortable && (
                <DragHandleOutlined style={{ width: "24px", height: "24px" }} />
              )}
              <Typography sx={ellipsis()} variant="body2" fontSize={14}>
                {title}
              </Typography>
              <Typography
                sx={ellipsis()}
                variant="body2"
                fontSize={14}
                color="text.secondary"
              >
                {filePath}
              </Typography>
            </Stack>

            <IconButton onClick={() => onRemove(targetUuid)}>
              <CloseOutlined style={{ width: "20px", height: "20px" }} />
            </IconButton>
          </Stack>
        ))}
      </SortableStack>
    </Box>
  );
};
