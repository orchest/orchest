import { SortableStack } from "@/components/SortableStack";
import { StepState } from "@/types";
import { ellipsis } from "@/utils/styles";
import { toValidFilename } from "@/utils/toValidFilename";
import { CloseOutlined, DragHandleOutlined } from "@mui/icons-material";
import { IconButton } from "@mui/material";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import "codemirror/mode/javascript/javascript";
import React from "react";
import { useStepDetailsContext } from "./StepDetailsContext";

export type StepDetailsConnectionsProps = {
  onSave: (
    payload: Partial<StepState>,
    uuid: string,
    replace?: boolean
  ) => void;
};

export const StepDetailsConnections = ({
  onSave,
}: StepDetailsConnectionsProps) => {
  const {
    step,
    steps,
    disconnect: severConnection,
    connections,
  } = useStepDetailsContext();

  // Mostly for new steps, where user is assumed to start typing Step Title,
  // then Step File Path is then automatically generated.
  const autogenerateFilePath = React.useRef(step.file_path.length === 0);

  const onChangeFilePath = React.useCallback(
    (newFilePath: string) => {
      if (newFilePath.length > 0) {
        autogenerateFilePath.current = false;
      } else if (newFilePath !== step.file_path) {
        onSave({ file_path: newFilePath }, step.uuid);
      }
    },
    [onSave, step.uuid, step.file_path]
  );

  const reorder = (ia: number, ib: number) => {
    if (ia !== ib) {
      const connections = [...step.incoming_connections];
      const [old] = connections.splice(ia, 1);
      connections.splice(ib, 0, old);

      onSave({ incoming_connections: connections }, step.uuid);
    }
  };

  const removeIncoming = (index: number) => {
    const startNodeUUID = step.incoming_connections[index];

    if (startNodeUUID) {
      severConnection(startNodeUUID, step.uuid);
    }
  };

  const removeOutgoing = (index: number) => {
    const endNodeUUID = step.outgoing_connections[index];
    const endStep = steps[endNodeUUID];
    const startNodeUUID = endStep?.incoming_connections.find(
      (uuid) => uuid === step.uuid
    );

    if (startNodeUUID) {
      severConnection(startNodeUUID, endNodeUUID);
      const newConn = step.outgoing_connections.filter((_, i) => i !== index);

      onSave({ outgoing_connections: newConn }, step.uuid, true);
    }
  };

  React.useEffect(() => {
    if (step.file_path.length === 0) {
      onChangeFilePath(toValidFilename(step.title));
    }
  }, [onChangeFilePath, step.file_path.length, step.title]);

  return (
    <Stack direction="column" spacing={3}>
      <Box>
        <Typography
          component="div"
          variant="subtitle2"
          fontSize="14px"
          color="text.secondary"
          sx={{ padding: (theme) => theme.spacing(0, 0) }}
        >
          Incoming
        </Typography>
        <SortableStack
          onUpdate={async (oldIndex, newIndex) => reorder(oldIndex, newIndex)}
        >
          {step.incoming_connections.map((uuid, i) => (
            <Stack
              flexDirection="row"
              key={uuid}
              alignItems="center"
              justifyContent="space-between"
              sx={{ width: "100%" }}
            >
              <Stack flexShrink={1} flexDirection="row" gap={1.5} minWidth="0">
                <DragHandleOutlined style={{ width: "24px", height: "24px" }} />
                <Typography sx={ellipsis()} variant="body2" fontSize={14}>
                  {connections[uuid].title}
                </Typography>
                <Typography
                  sx={ellipsis()}
                  variant="body2"
                  fontSize={14}
                  color="text.secondary"
                >
                  {connections[uuid].file_path}
                </Typography>
              </Stack>

              <IconButton onClick={() => removeIncoming(i)}>
                <CloseOutlined style={{ width: "20px", height: "20px" }} />
              </IconButton>
            </Stack>
          ))}
        </SortableStack>
      </Box>
      <Box>
        <Typography
          component="div"
          variant="subtitle2"
          fontSize="14px"
          color="text.secondary"
          sx={{ padding: (theme) => theme.spacing(0, 0) }}
        >
          Outgoing
        </Typography>
        {step.outgoing_connections?.map((uuid, i) => (
          <Stack
            flexDirection="row"
            key={uuid}
            alignItems="center"
            justifyContent="space-between"
            sx={{ width: "100%" }}
          >
            <Stack flexShrink={1} flexDirection="row" gap={1.5} minWidth="0">
              <Typography sx={ellipsis()} variant="body2" fontSize={14}>
                {connections[uuid].title}
              </Typography>
              <Typography
                sx={ellipsis()}
                variant="body2"
                fontSize={14}
                color="text.secondary"
              >
                {connections[uuid].file_path}
              </Typography>
            </Stack>

            <IconButton onClick={() => removeOutgoing(i)}>
              <CloseOutlined style={{ width: "20px", height: "20px" }} />
            </IconButton>
          </Stack>
        ))}
      </Box>
    </Stack>
  );
};
