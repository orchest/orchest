import { getOffset } from "@/utils/jquery-replacement";
import { uuidv4 } from "@orchest/lib-utils";
import React from "react";
import { getScaleCorrectedPosition } from "../common";
import { usePipelineEditorContext } from "../contexts/PipelineEditorContext";
import { STEP_HEIGHT, STEP_WIDTH } from "../PipelineStep";
import { FileManager } from "./FileManager";

export const ProjectFileManager = () => {
  const {
    mouseTracker,
    pipelineCanvasRef,
    environments,
    dispatch,
    eventVars,
  } = usePipelineEditorContext();

  const environment = environments.length > 0 ? environments[0] : null;

  return (
    <FileManager
      onDropOutside={(props, selected) => {
        const clientPosition = {
          x: mouseTracker.current.client.x - STEP_WIDTH / 2,
          y: mouseTracker.current.client.y - STEP_HEIGHT / 2,
        };
        const { x, y } = getScaleCorrectedPosition({
          offset: getOffset(pipelineCanvasRef.current),
          position: clientPosition,
          scaleFactor: eventVars.scaleFactor,
        });

        const position = [x, y] as [number, number];

        selected.forEach((filePath) => {
          const cleanFilePath = filePath.replace(/^\/project-dir\:\//, "");
          dispatch({
            type: "CREATE_STEP",
            payload: {
              title: "",
              uuid: uuidv4(),
              incoming_connections: [],
              file_path: cleanFilePath,
              kernel: {
                name: environment?.language || "python",
                display_name: environment?.name || "Python",
              },
              environment: environment?.uuid,
              parameters: {},
              meta_data: {
                position,
                hidden: false,
              },
            },
          });
        });
      }}
      onEdit={(props) => {
        console.log("DEV onEdit", props);
      }}
      onOpen={(props) => {
        console.log("DEV onOpen", props);
      }}
      onSelect={(props) => {
        console.log("DEV onSelect", props);
      }}
      onView={(props) => {
        console.log("DEV onView", props);
      }}
    />
  );
};
