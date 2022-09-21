import { EnvironmentData } from "@/types";
import { Point2D } from "@/utils/geometry";
import { uuidv4 } from "@orchest/lib-utils";
import { Action } from "../hooks/usePipelineUiState";

export const createStepAction = (
  environment: EnvironmentData | null,
  dropPoint: Point2D,
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
        position: dropPoint,
        hidden: false,
      },
    },
  };
};
