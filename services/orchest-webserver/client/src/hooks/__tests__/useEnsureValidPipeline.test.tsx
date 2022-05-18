import {
  IProjectsContextState,
  ProjectsContextAction,
  ProjectsContextProvider,
  useProjectsContext,
} from "@/contexts/ProjectsContext";
import { PipelineMetaData } from "@/types";
import { chance } from "@/__mocks__/common.mock";
import {
  getPipelineMedadatas,
  mockProjects,
} from "@/__mocks__/mockProjects.mock";
import { server } from "@/__mocks__/server.mock";
import { act, renderHook } from "@testing-library/react-hooks";
import * as React from "react";
import { useEnsureValidPipelineBase } from "../useEnsureValidPipeline";

let mockData: {
  project1Uuid: string;
  project2Uuid: string;
  project1Pipelines: PipelineMetaData[];
  project2Pipelines: PipelineMetaData[];
} = {
  project1Uuid: "",
  project2Uuid: "",
  project1Pipelines: [],
  project2Pipelines: [],
};

const navigateToMock = jest.fn(
  (pipelineUuid: string, replace: boolean) => undefined
);

const wrapper = ({ children = null }) => {
  return <ProjectsContextProvider>{children}</ProjectsContextProvider>;
};

const useTestHook = (pipelineUuid: string | undefined) => {
  const { state, dispatch } = useProjectsContext();
  const shouldShowAlert = useEnsureValidPipelineBase(
    navigateToMock,
    pipelineUuid
  );

  return { state, dispatch, shouldShowAlert };
};

const resetMock = () => {
  mockProjects.reset();

  const project1Uuid = chance.guid();
  const project2Uuid = chance.guid();

  Array.from(Array(2)).forEach(() => {
    mockProjects.get(project1Uuid).pipelines.get(chance.guid());
    mockProjects.get(project2Uuid).pipelines.get(chance.guid());
  });

  const project1Pipelines = getPipelineMedadatas(project1Uuid);
  const project2Pipelines = getPipelineMedadatas(project2Uuid);

  mockData = {
    project1Uuid,
    project2Uuid,
    project1Pipelines,
    project2Pipelines,
  };
};

describe("useEnsureValidPipeline", () => {
  const {
    result,
    waitForNextUpdate,
    rerender,
    unmount,
    waitForValueToChange,
  } = renderHook<
    {
      children?: null;
      pipelineUuid: string | undefined;
    },
    {
      state: IProjectsContextState;
      dispatch: (value: ProjectsContextAction) => void;
      shouldShowAlert: boolean;
    }
  >(({ pipelineUuid }) => useTestHook(pipelineUuid), {
    wrapper,
    initialProps: { pipelineUuid: undefined },
  });

  const loadProject1AfterMounted = async (
    pipelineUuid: string | undefined,
    expectedPipeline: PipelineMetaData
  ) => {
    act(() => {
      result.current.dispatch({
        type: "SET_PROJECT",
        payload: mockData.project1Uuid,
      });
    });

    rerender({ pipelineUuid });

    expect(result.current.state.projectUuid).toEqual(mockData.project1Uuid);
    expect(result.current.state.pipelines).toEqual(undefined);
    expect(result.current.state.pipeline).toEqual(undefined);
    expect(result.current.shouldShowAlert).toEqual(false);

    await waitForNextUpdate();
    expect(result.current.state.projectUuid).toEqual(mockData.project1Uuid);
    expect(result.current.state.pipelines).toEqual(mockData.project1Pipelines);
    expect(result.current.state.pipeline).toEqual(expectedPipeline);
    expect(result.current.shouldShowAlert).toEqual(false);
    expect(navigateToMock.mock.calls.length).toEqual(1);
    expect(navigateToMock.mock.calls[0]).toEqual([expectedPipeline.uuid, true]);
  };

  beforeEach(async () => {
    localStorage.clear();
    resetMock();

    rerender({ pipelineUuid: undefined });

    expect(result.current.state.projectUuid).toEqual(undefined);
    expect(result.current.state.pipelines).toEqual(undefined);
    expect(result.current.state.pipeline).toEqual(undefined);

    // Before each test case, check if it loads the first pipeline of the given project `mockData.project1Uuid`.

    act(() => {
      result.current.dispatch({
        type: "SET_PROJECTS",
        payload: [
          mockProjects.get(mockData.project1Uuid).project,
          mockProjects.get(mockData.project2Uuid).project,
        ],
      });
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    unmount();
  });

  it("should navigate to the first pipeline from the pipelines if pipelineUuid is undefined", async () => {
    await loadProject1AfterMounted(undefined, mockData.project1Pipelines[0]);
  });

  it("should not redirect if target pipeline UUID is the same", async () => {
    await loadProject1AfterMounted(undefined, mockData.project1Pipelines[0]);

    rerender({ pipelineUuid: mockData.project1Pipelines[1].uuid });

    expect(result.current.state.projectUuid).toEqual(mockData.project1Uuid);
    expect(result.current.state.pipelines).toEqual(mockData.project1Pipelines);
    expect(result.current.state.pipeline).toEqual(
      mockData.project1Pipelines[1]
    );
    expect(result.current.shouldShowAlert).toEqual(false);

    expect(navigateToMock.mock.calls.length).toEqual(1);
    expect(navigateToMock.mock.calls[0]).toEqual([
      mockData.project1Pipelines[0].uuid,
      true,
    ]);
  });

  it("should refetch pipelines when switching projects", async () => {
    await loadProject1AfterMounted(undefined, mockData.project1Pipelines[0]);

    act(() => {
      result.current.dispatch({
        type: "SET_PROJECT",
        payload: mockData.project2Uuid,
      });
    });

    rerender({ pipelineUuid: undefined });

    expect(result.current.state.projectUuid).toEqual(mockData.project2Uuid);
    expect(result.current.state.pipelines).toEqual(undefined);
    expect(result.current.state.pipeline).toEqual(undefined);

    await waitForNextUpdate();

    expect(result.current.state.projectUuid).toEqual(mockData.project2Uuid);
    expect(result.current.state.pipelines).toEqual(mockData.project2Pipelines);
    expect(result.current.state.pipeline).toEqual(
      mockData.project2Pipelines[0]
    );
    expect(result.current.shouldShowAlert).toEqual(false);
  });

  it("should load the last-seen pipeline within the same project if pipeline UUID is undefined", async () => {
    await loadProject1AfterMounted(undefined, mockData.project1Pipelines[0]);

    // Visit the non-first pipeline as the last-seen pipeline
    rerender({ pipelineUuid: mockData.project1Pipelines[1].uuid });

    expect(result.current.state.projectUuid).toEqual(mockData.project1Uuid);
    expect(result.current.state.pipelines).toEqual(mockData.project1Pipelines);
    expect(result.current.state.pipeline).toEqual(
      mockData.project1Pipelines[1]
    );
    expect(result.current.shouldShowAlert).toEqual(false);

    expect(navigateToMock.mock.calls.length).toEqual(1);

    // Set pipelineUuid as undefined
    rerender({ pipelineUuid: undefined });

    // Load the last-seen pipeline instead of the default "fist" pipeline
    expect(result.current.state.pipelines).toEqual(mockData.project1Pipelines);
    expect(result.current.state.pipeline).toEqual(
      mockData.project1Pipelines[1]
    );
    expect(navigateToMock.mock.calls.length).toEqual(1);
  });

  it("should load the last-seen pipeline with an alert if pipelineUuid is invalid", async () => {
    await loadProject1AfterMounted(undefined, mockData.project1Pipelines[0]);

    rerender({ pipelineUuid: mockData.project1Pipelines[1].uuid });

    expect(navigateToMock.mock.calls.length).toEqual(1);

    rerender({ pipelineUuid: "invalid-pipeline-uuid" });

    expect(result.current.state.projectUuid).toEqual(mockData.project1Uuid);
    expect(result.current.state.pipelines).toEqual(mockData.project1Pipelines);
    expect(result.current.state.pipeline).toEqual(
      mockData.project1Pipelines[1]
    );

    expect(navigateToMock.mock.calls.length).toEqual(1);

    expect(result.current.shouldShowAlert).toEqual(true);
  });

  it("should navigate to the new pipeline without an alert after creating a new pipeline", async () => {
    await loadProject1AfterMounted(undefined, mockData.project1Pipelines[0]);
    // create a new pipeline for project 1
    const newPipelineUuid = chance.guid();
    mockProjects.get(mockData.project1Uuid).pipelines.get(newPipelineUuid);

    server.resetHandlers();

    act(() => {
      result.current.dispatch({
        type: "ADD_PIPELINE",
        payload: mockProjects
          .get(mockData.project1Uuid)
          .pipelines.get(newPipelineUuid).metadata,
      });
    });

    rerender({ pipelineUuid: newPipelineUuid });

    expect(result.current.state.projectUuid).toEqual(mockData.project1Uuid);
    expect(result.current.state.pipelines).toEqual(
      getPipelineMedadatas(mockData.project1Uuid)
    );
    expect(result.current.state.pipeline).toEqual(
      mockProjects.get(mockData.project1Uuid).pipelines.get(newPipelineUuid)
        .metadata
    );
    expect(result.current.state.newPipelineUuid).toEqual(newPipelineUuid);
    expect(result.current.shouldShowAlert).toEqual(false);

    expect(navigateToMock.mock.calls.length).toEqual(1);
  });

  it("should load the last-seen pipeline per project if pipeline UUID is undefined", async () => {
    await loadProject1AfterMounted(undefined, mockData.project1Pipelines[0]);
    // projectUuid is already set to mockData.project1Uuid
    // Load project1Pipelines[1], which is NOT the first pipeline in the list
    rerender({ pipelineUuid: mockData.project1Pipelines[1].uuid });

    expect(result.current.state.projectUuid).toEqual(mockData.project1Uuid);
    expect(result.current.state.pipelines).toEqual(mockData.project1Pipelines);
    expect(result.current.state.pipeline).toEqual(
      mockData.project1Pipelines[1]
    );

    rerender({ pipelineUuid: undefined });

    expect(result.current.state.projectUuid).toEqual(mockData.project1Uuid);
    expect(result.current.state.pipelines).toEqual(mockData.project1Pipelines);
    expect(result.current.state.pipeline).toEqual(
      mockData.project1Pipelines[1]
    );

    // Load project2Pipelines[1], which is NOT the first pipeline in the list
    act(() => {
      result.current.dispatch({
        type: "SET_PROJECT",
        payload: mockData.project2Uuid,
      });
    });

    rerender({ pipelineUuid: mockData.project2Pipelines[1].uuid });

    await waitForNextUpdate();

    expect(result.current.state.projectUuid).toEqual(mockData.project2Uuid);
    expect(result.current.state.pipelines).toEqual(mockData.project2Pipelines);
    expect(result.current.state.pipeline).toEqual(
      mockData.project2Pipelines[1]
    );

    rerender({ pipelineUuid: undefined });

    expect(result.current.state.projectUuid).toEqual(mockData.project2Uuid);
    expect(result.current.state.pipelines).toEqual(mockData.project2Pipelines);
    expect(result.current.state.pipeline).toEqual(
      mockData.project2Pipelines[1]
    );

    act(() => {
      result.current.dispatch({
        type: "SET_PROJECT",
        payload: mockData.project1Uuid,
      });
    });

    rerender({ pipelineUuid: undefined });

    await waitForNextUpdate();

    expect(result.current.state.projectUuid).toEqual(mockData.project1Uuid);
    expect(result.current.state.pipelines).toEqual(mockData.project1Pipelines);
    expect(result.current.state.pipeline).toEqual(
      mockData.project1Pipelines[1]
    );

    act(() => {
      result.current.dispatch({
        type: "SET_PROJECT",
        payload: mockData.project2Uuid,
      });
    });

    rerender({ pipelineUuid: undefined });

    await waitForNextUpdate();

    expect(result.current.state.projectUuid).toEqual(mockData.project2Uuid);
    expect(result.current.state.pipelines).toEqual(mockData.project2Pipelines);
    expect(result.current.state.pipeline).toEqual(
      mockData.project2Pipelines[1]
    );
  });
});
