import { StepState } from "@/types";
import { toValidFilename } from "@/utils/toValidFilename";
import Stack from "@mui/material/Stack";
import React from "react";
import { ConnectionList } from "./ConnectionList";
import { useStepDetailsContext } from "./StepDetailsContext";

export type StepConnectionProps = {
  onSave(payload: Partial<StepState>, uuid: string): void;
};

export const StepConnections = ({ onSave }: StepConnectionProps) => {
  const { step, disconnect, connections } = useStepDetailsContext();

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

  const reorderIncoming = (ia: number, ib: number) => {
    if (ia !== ib) {
      const connections = [...step.incoming_connections];
      const [old] = connections.splice(ia, 1);
      connections.splice(ib, 0, old);

      onSave({ incoming_connections: connections }, step.uuid);
    }
  };

  React.useEffect(() => {
    if (step.file_path.length === 0) {
      onChangeFilePath(toValidFilename(step.title));
    }
  }, [onChangeFilePath, step.file_path.length, step.title]);

  return (
    <Stack direction="column" spacing={3}>
      <ConnectionList
        direction="incoming"
        hint="Drag & drop to order incoming data passing for this step"
        sortable={true}
        onRemove={(uuid) => disconnect(uuid, step.uuid)}
        onSwap={reorderIncoming}
        connections={connections.filter(
          ({ direction }) => direction === "incoming"
        )}
      />
      <ConnectionList
        hint="Outgoing data passing can't be ordered"
        direction="outgoing"
        sortable={false}
        onRemove={(uuid) => disconnect(step.uuid, uuid)}
        connections={connections.filter(
          ({ direction }) => direction === "outgoing"
        )}
      />
    </Stack>
  );
};
