import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useForceUpdate } from "@/hooks/useForceUpdate";
import {
  MouseTracker,
  NewConnection,
  PipelineJson,
  Position,
  StepsDict,
} from "@/types";
import { getOffset } from "@/utils/jquery-replacement";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { getScaleCorrectedPosition } from "../common";
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
  pipelineCanvasRef: React.MutableRefObject<HTMLDivElement | null>;
  pipelineViewportRef: React.MutableRefObject<HTMLDivElement | null>;
  newConnection: React.MutableRefObject<NewConnection | undefined>;
  keysDown: Set<number | string>;
  trackMouseMovement: (clientX: number, clientY: number) => void;
  mouseTracker: React.MutableRefObject<MouseTracker>;
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
  getOnCanvasPosition: (offset: Position) => Position;
  disabled: boolean;
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
  const {
    state: { pipelines },
  } = useProjectsContext();

  const { isReadOnly } = usePipelineDataContext();

  // No pipeline found. Editor is frozen and shows "Pipeline not found".
  const disabled = hasValue(pipelines) && pipelines.length === 0;

  const pipelineCanvasRef = React.useRef<HTMLDivElement | null>(null);
  const pipelineViewportRef = React.useRef<HTMLDivElement | null>(null);

  const {
    eventVars,
    dispatch,
    stepDomRefs,
    newConnection,
    keysDown,
    trackMouseMovement,
    mouseTracker,
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

  React.useEffect(() => {
    const startTracking = (e: MouseEvent) =>
      trackMouseMovement(e.clientX, e.clientY);
    document.body.addEventListener("mousemove", startTracking);
    return () => document.body.removeEventListener("mousemove", startTracking);
  }, [trackMouseMovement]);

  // in read-only mode, PipelineEditor doesn't re-render after stepDomRefs collects all DOM elements of the steps
  // we need to force re-render one more time to show the connection lines
  const shouldForceRerender =
    isReadOnly &&
    eventVars.connections.length > 0 &&
    Object.keys(stepDomRefs.current).length === 0;

  const [, forceUpdate] = useForceUpdate();

  React.useLayoutEffect(() => {
    if (shouldForceRerender) forceUpdate();
  }, [shouldForceRerender, forceUpdate]);

  const getOnCanvasPosition = React.useCallback(
    (offset: Position = { x: 0, y: 0 }): Position => {
      const clientPosition = {
        x: mouseTracker.current.client.x - offset.x,
        y: mouseTracker.current.client.y - offset.y,
      };
      const { x, y } = getScaleCorrectedPosition({
        offset: getOffset(pipelineCanvasRef.current),
        position: clientPosition,
        scaleFactor: eventVars.scaleFactor,
      });

      return { x, y };
    },
    [eventVars.scaleFactor, mouseTracker, pipelineCanvasRef]
  );

  const [isContextMenuOpen, setIsContextMenuOpen] = React.useState(false);

  return (
    <PipelineEditorContext.Provider
      value={{
        eventVars,
        dispatch,
        stepDomRefs,
        pipelineCanvasRef,
        pipelineViewportRef,
        newConnection,
        keysDown,
        trackMouseMovement,
        mouseTracker,
        metadataPositions,
        pipelineJson,
        setPipelineJson,
        hash,
        zIndexMax,
        instantiateConnection,
        getOnCanvasPosition,
        disabled,
        isContextMenuOpen,
        setIsContextMenuOpen,
      }}
    >
      {children}
    </PipelineEditorContext.Provider>
  );
};
