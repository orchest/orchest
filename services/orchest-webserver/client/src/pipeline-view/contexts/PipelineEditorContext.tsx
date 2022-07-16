import { useForceUpdate } from "@/hooks/useForceUpdate";
import { NewConnection, PipelineJson, StepsDict } from "@/types";
import React from "react";
import {
  EventVars,
  EventVarsAction,
  useEventVars,
} from "../hooks/useEventVars";
import { useInitializePipelineEditor } from "../hooks/useInitializePipelineEditor";
import { usePipelineDataContext } from "./PipelineDataContext";

export type PipelineEditorContextType = {
  eventVars: EventVars;
  dispatch: (value: EventVarsAction) => void;
  stepDomRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  newConnection: React.MutableRefObject<NewConnection | undefined>;
  metadataPositions: React.MutableRefObject<Record<string, [number, number]>>;
  pipelineJson: PipelineJson | undefined;
  setPipelineJson: (
    data?:
      | PipelineJson
      | ((currentValue: PipelineJson | undefined) => PipelineJson | undefined)
      | undefined,
    flushPage?: boolean | undefined
  ) => void;
  hash: React.MutableRefObject<string>;
  zIndexMax: React.MutableRefObject<number>;
  instantiateConnection: (
    startNodeUUID: string,
    endNodeUUID?: string | undefined
  ) => {
    startNodeUUID: string;
    endNodeUUID: string | undefined;
  };
  isContextMenuOpen: boolean;
  setIsContextMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export const PipelineEditorContext = React.createContext<PipelineEditorContextType | null>(
  null
);

export const usePipelineEditorContext = () => {
  const context = React.useContext(PipelineEditorContext);
  if (context === null) throw new Error("Context not initialized.");
  return context;
};

export const PipelineEditorContextProvider: React.FC = ({ children }) => {
  const { isReadOnly } = usePipelineDataContext();

  const {
    eventVars,
    dispatch,
    stepDomRefs,
    newConnection,
    metadataPositions,
  } = useEventVars();

  const instantiateConnection = React.useCallback(
    (startNodeUUID: string, endNodeUUID?: string | undefined) => {
      const connection = { startNodeUUID, endNodeUUID };

      dispatch({
        type: "INSTANTIATE_CONNECTION",
        payload: connection,
      });

      return connection;
    },
    [dispatch]
  );

  // calculate z-index max when initializing steps and connections.
  // zIndexMax is the initial total count of all steps and connections
  const zIndexMax = React.useRef<number>(0);
  // this is only called once when pipelineJson is loaded in the beginning
  const initializeEventVars = React.useCallback(
    (initialSteps: StepsDict) => {
      dispatch({ type: "SET_STEPS", payload: initialSteps });
      zIndexMax.current = Object.keys(initialSteps).length;
      Object.values(initialSteps).forEach((step) => {
        step.incoming_connections.forEach((startNodeUUID) => {
          let endNodeUUID = step.uuid;

          instantiateConnection(startNodeUUID, endNodeUUID);

          zIndexMax.current += 1;
        });
      });
    },
    [dispatch, instantiateConnection]
  );

  const { pipelineJson, setPipelineJson, hash } = useInitializePipelineEditor(
    initializeEventVars
  );

  // in read-only mode, PipelineEditor doesn't re-render after stepDomRefs collects all DOM elements of the steps
  // we need to force re-render one more time to show the connection lines
  const shouldForceRerender =
    isReadOnly &&
    eventVars.connections.length > 0 &&
    Object.keys(stepDomRefs.current).length === 0;

  const [, forceUpdate] = useForceUpdate();

  const [isContextMenuOpen, setIsContextMenuOpen] = React.useState(false);

  React.useLayoutEffect(() => {
    if (shouldForceRerender) forceUpdate();
  }, [shouldForceRerender, forceUpdate]);

  return (
    <PipelineEditorContext.Provider
      value={{
        eventVars,
        dispatch,
        stepDomRefs,
        newConnection,
        metadataPositions,
        pipelineJson,
        setPipelineJson,
        hash,
        zIndexMax,
        instantiateConnection,
        isContextMenuOpen,
        setIsContextMenuOpen,
      }}
    >
      {children}
    </PipelineEditorContext.Provider>
  );
};
