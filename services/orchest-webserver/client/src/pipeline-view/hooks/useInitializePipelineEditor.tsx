import { PipelineJson } from "@/types";
import { uuidv4 } from "@orchest/lib-utils";
import React from "react";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";

export const useInitializePipelineEditor = () => {
  const {
    pipelineJson,
    setPipelineJson: originalSetPipelineJson,
    isFetchingPipelineJson,
  } = usePipelineDataContext();

  const hash = React.useRef<string>(uuidv4());
  const setPipelineJson = React.useCallback(
    (
      data?:
        | PipelineJson
        | ((currentValue: PipelineJson | undefined) => PipelineJson | undefined)
        | undefined,
      flushPage?: boolean
    ) => {
      // in case you want to re-initialize all components according to the new PipelineJson
      // to be part of the re-initialization, you need to assign hash.current as part of the key of your component
      if (flushPage) hash.current = uuidv4();
      originalSetPipelineJson(data);
    },
    [originalSetPipelineJson]
  );

  return {
    pipelineJson,
    setPipelineJson,
    hash,
    isFetching: isFetchingPipelineJson,
  };
};
