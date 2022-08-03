import { Environment, Position } from "@/types";
import { uuidv4 } from "@orchest/lib-utils";
import { Action } from "../hooks/usePipelineUiState";

export const createStepAction = (
  environment: Environment | null,
  position: Position,
  filePath = ""
): Action => {
  return {
    type: "CREATE_STEP",
    payload: {
      title: "",
      uuid: uuidv4(),
      incoming_connections: [],
      outgoing_connections: [],
      file_path: filePath,
      kernel: {
        name: environment?.language || "python",
        display_name: environment?.name || "Python",
      },
      environment: environment?.uuid || "",
      parameters: {},
      meta_data: {
        position: [position.x, position.y],
        hidden: false,
      },
    },
  };
};
