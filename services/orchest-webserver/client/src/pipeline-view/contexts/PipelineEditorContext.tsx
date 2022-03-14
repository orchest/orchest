import { useAppContext } from "@/contexts/AppContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useForceUpdate } from "@/hooks/useForceUpdate";
import { siteMap } from "@/Routes";
import {
  Environment,
  IOrchestSession,
  MouseTracker,
  NewConnection,
  PipelineJson,
  StepsDict,
} from "@/types";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { MutatorCallback } from "swr";
import { useAutoStartSession } from "../hooks/useAutoStartSession";
import {
  EventVars,
  EventVarsAction,
  useEventVars,
} from "../hooks/useEventVars";
import { useFetchInteractiveRun } from "../hooks/useFetchInteractiveRun";
import { useInitializePipelineEditor } from "../hooks/useInitializePipelineEditor";
import { useIsReadOnly } from "../hooks/useIsReadOnly";
import { SocketIO, useSocketIO } from "../hooks/useSocketIO";

export type PipelineEditorContextType = {
  projectUuid: string;
  pipelineUuid: string | undefined;
  jobUuid: string;
  runUuid: string | undefined;
  eventVars: EventVars;
  dispatch: (value: EventVarsAction) => void;
  stepDomRefs: React.MutableRefObject<Record<string, HTMLDivElement>>;
  pipelineCanvasRef: React.MutableRefObject<HTMLDivElement>;
  newConnection: React.MutableRefObject<NewConnection>;
  keysDown: Set<number | string>;
  trackMouseMovement: (clientX: number, clientY: number) => void;
  mouseTracker: React.MutableRefObject<MouseTracker>;
  metadataPositions: React.MutableRefObject<Record<string, [number, number]>>;
  pipelineCwd: string;
  pipelineJson: PipelineJson;
  environments: Environment[];
  setPipelineJson: (
    data?: PipelineJson | Promise<PipelineJson> | MutatorCallback<PipelineJson>,
    flushPage?: boolean
  ) => void;
  hash: React.MutableRefObject<string>;
  fetchDataError: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  setRunUuid: (
    data?: string | Promise<string> | MutatorCallback<string>
  ) => Promise<string>;
  zIndexMax: React.MutableRefObject<number>;
  isReadOnly: boolean;
  instantiateConnection: (
    startNodeUUID: string,
    endNodeUUID?: string | undefined
  ) => {
    startNodeUUID: string;
    endNodeUUID: string;
  };
  sio: SocketIO;
  session: IOrchestSession;
  openNotebook: (e: React.MouseEvent | undefined, filePath: string) => void;
};

export const PipelineEditorContext = React.createContext<
  PipelineEditorContextType
>(null);

export const usePipelineEditorContext = () =>
  React.useContext(PipelineEditorContext);

export const PipelineEditorContextProvider: React.FC = ({ children }) => {
  const {
    projectUuid,
    pipelineUuid,
    jobUuid,
    runUuid: runUuidFromRoute,
    isReadOnly: isReadOnlyFromQueryString,
    navigateTo,
  } = useCustomRoute();

  const { setAlert } = useAppContext();

  const pipelineCanvasRef = React.useRef<HTMLDivElement>();

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

  const { runUuid, setRunUuid } = useFetchInteractiveRun(
    projectUuid,
    pipelineUuid,
    runUuidFromRoute
  );

  const isJobRun = hasValue(jobUuid && runUuidFromRoute);
  const isReadOnly = useIsReadOnly(
    projectUuid,
    jobUuid,
    runUuid,
    isJobRun || isReadOnlyFromQueryString
  );

  const {
    pipelineCwd,
    pipelineJson,
    environments,
    setPipelineJson,
    hash,
    error: fetchDataError,
  } = useInitializePipelineEditor(
    pipelineUuid,
    projectUuid,
    jobUuid,
    runUuid,
    isReadOnly,
    initializeEventVars
  );

  const sio = useSocketIO();

  const session = useAutoStartSession({
    projectUuid,
    pipelineUuid,
    isReadOnly,
  });

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
  const openNotebook = React.useCallback(
    (e: React.MouseEvent | undefined, filePath: string) => {
      if (session?.status === "RUNNING") {
        navigateTo(
          siteMap.jupyterLab.path,
          { query: { projectUuid, pipelineUuid, filePath } },
          e
        );
        return;
      }
      if (session?.status === "LAUNCHING") {
        setAlert(
          "Error",
          "Please wait for the session to start before opening the Notebook in Jupyter."
        );
        return;
      }

      setAlert(
        "Error",
        "Please start the session before opening the Notebook in Jupyter."
      );
    },
    [setAlert, session?.status, navigateTo, pipelineUuid, projectUuid]
  );

  return (
    <PipelineEditorContext.Provider
      value={{
        projectUuid,
        pipelineUuid,
        eventVars,
        dispatch,
        stepDomRefs,
        pipelineCanvasRef,
        newConnection,
        keysDown,
        trackMouseMovement,
        mouseTracker,
        metadataPositions,
        pipelineCwd,
        pipelineJson,
        environments,
        setPipelineJson,
        hash,
        fetchDataError,
        runUuid,
        setRunUuid,
        zIndexMax,
        isReadOnly,
        instantiateConnection,
        jobUuid,
        sio,
        session,
        openNotebook,
      }}
    >
      {children}
    </PipelineEditorContext.Provider>
  );
};
