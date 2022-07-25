import { SortableStack } from "@/components/SortableStack";
import { Step } from "@/types";
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

export type ConnectionDict = Record<
  string,
  { title: string; file_path: string }
>;

export type StepDetailsConnectionsProps = {
  onSave: (payload: Partial<Step>, uuid: string, replace?: boolean) => void;
};

export const StepDetailsConnections = ({
  onSave,
}: StepDetailsConnectionsProps) => {
  const { step, connections } = useStepDetailsContext();

  // Mostly for new steps, where user is assumed to start typing Step Title,
  // then Step File Path is then automatically generated.
  const autogenerateFilePath = React.useRef(step.file_path.length === 0);

  const onChangeFilePath = React.useCallback(
    (newFilePath: string) => {
      if (newFilePath.length > 0) {
        autogenerateFilePath.current = false;
      }
      if (newFilePath !== step.file_path)
        onSave({ file_path: newFilePath }, step.uuid);
    },
    [onSave, step.uuid, step.file_path]
  );

  const swapConnectionOrder = (
    oldConnectionIndex: number,
    newConnectionIndex: number
  ) => {
    // check if there is work to do
    if (oldConnectionIndex !== newConnectionIndex) {
      // note it's creating a reference
      const connections = [...step.incoming_connections];

      let tmp = connections[oldConnectionIndex];
      connections.splice(oldConnectionIndex, 1);
      connections.splice(newConnectionIndex, 0, tmp);

      onSave({ incoming_connections: connections }, step.uuid);
    }
  };

  const removeConnection = (index: number) => {
    const connections = step.incoming_connections.filter((_, i) => i !== index);

    onSave({ incoming_connections: connections }, step.uuid, true);
  };

  React.useEffect(() => {
    if (step.file_path.length === 0) {
      onChangeFilePath(toValidFilename(step.title));
    }
  }, [onChangeFilePath, step.file_path.length, step.title]);

  return (
    <Stack direction="column" spacing={3}>
      {step.incoming_connections?.length ? (
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
            onUpdate={async (oldIndex, newIndex) =>
              swapConnectionOrder(oldIndex, newIndex)
            }
          >
            {step.incoming_connections.map((startNodeUUID, i) => (
              <Stack
                flexDirection="row"
                key={startNodeUUID}
                alignItems="center"
                justifyContent="space-between"
                sx={{ width: "100%" }}
              >
                <Stack
                  flexShrink={1}
                  flexDirection="row"
                  gap={1.5}
                  minWidth="0"
                >
                  <DragHandleOutlined
                    style={{ width: "24px", height: "24px" }}
                  />
                  <Typography sx={ellipsis()} variant="body2" fontSize={14}>
                    {connections[startNodeUUID].title}
                  </Typography>
                  <Typography
                    sx={ellipsis()}
                    variant="body2"
                    fontSize={14}
                    color="text.secondary"
                  >
                    {connections[startNodeUUID].file_path}
                  </Typography>
                </Stack>

                <IconButton onClick={() => removeConnection(i)}>
                  <CloseOutlined style={{ width: "20px", height: "20px" }} />
                </IconButton>
              </Stack>
            ))}
          </SortableStack>
        </Box>
      ) : null}
      {step.outgoing_connections?.length ? (
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
          {step.outgoing_connections.map((nodeUuid, i) => (
            <Stack
              flexDirection="row"
              key={nodeUuid}
              alignItems="center"
              justifyContent="space-between"
              sx={{ width: "100%" }}
            >
              <Stack flexShrink={1} flexDirection="row" gap={1.5} minWidth="0">
                <Typography sx={ellipsis()} variant="body2" fontSize={14}>
                  {connections[nodeUuid].title}
                </Typography>
                <Typography
                  sx={ellipsis()}
                  variant="body2"
                  fontSize={14}
                  color="text.secondary"
                >
                  {connections[nodeUuid].file_path}
                </Typography>
              </Stack>

              <IconButton onClick={() => removeConnection(i)}>
                <CloseOutlined style={{ width: "20px", height: "20px" }} />
              </IconButton>
            </Stack>
          ))}
        </Box>
      ) : null}
    </Stack>
  );
};
