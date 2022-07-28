import { StepState } from "@/types";
import { toValidFilename } from "@/utils/toValidFilename";
import Stack from "@mui/material/Stack";
import "codemirror/mode/javascript/javascript";
import React from "react";
import { ConnectionList } from "./ConnectionList";
import { useStepDetailsContext } from "./StepDetailsContext";

export type StepConnectionProps = {
  onSave: (
    payload: Partial<StepState>,
    uuid: string,
    replace?: boolean
  ) => void;
};

export const StepConnections = ({ onSave }: StepConnectionProps) => {
  const { step, steps, disconnect, connections } = useStepDetailsContext();

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

  const removeIncoming = (index: number) => {
    const startNodeUUID = step.incoming_connections[index];

    if (startNodeUUID) {
      disconnect(startNodeUUID, step.uuid);
    }
  };

  const removeOutgoing = (index: number) => {
    const endNodeUUID = step.outgoing_connections[index];
    const endStep = steps[endNodeUUID];
    const startNodeUUID = endStep?.incoming_connections.find(
      (uuid) => uuid === step.uuid
    );

    if (startNodeUUID) {
      disconnect(step.uuid, endNodeUUID);
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
        title="Incoming"
        sortable={true}
        onRemove={removeIncoming}
        onSwap={reorderIncoming}
        connections={step.incoming_connections.map((uuid) => ({
          ...connections[uuid],
          uuid,
        }))}
      />
      <ConnectionList
        title="Outgoing"
        sortable={false}
        onRemove={removeOutgoing}
        connections={step.outgoing_connections.map((uuid) => ({
          ...connections[uuid],
          uuid,
        }))}
      />
    </Stack>
  );
};
