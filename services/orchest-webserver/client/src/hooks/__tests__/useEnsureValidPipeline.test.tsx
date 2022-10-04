import {
  ProjectsContextAction,
  ProjectsContextProvider,
  ProjectsContextState,
  useProjectsContext,
} from "@/contexts/ProjectsContext";
import { PipelineMetaData } from "@/types";
import { chance } from "@/__mocks__/common.mock";
import {
  listPipelineMetadata,
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
  (projectUuid: string, pipelineUuid: string, replace: boolean) => undefined
);

const wrapper = ({ children = null }) => {
  return <ProjectsContextProvider>{children}</ProjectsContextProvider>;
};

const useTestHook = (
  projectUuid: string | undefined,
  pipelineUuid: string | undefined
) => {
  const { state, dispatch } = useProjectsContext();
  const shouldShowAlert = useEnsureValidPipelineBase(
    navigateToMock,
    projectUuid,
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

  const project1Pipelines = listPipelineMetadata(project1Uuid);
  const project2Pipelines = listPipelineMetadata(project2Uuid);

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
      projectUuid: string | undefined;
      pipelineUuid: string | undefined;
    },
    {
      state: ProjectsContextState;
      dispatch: (value: ProjectsContextAction) => void;
      shouldShowAlert: boolean;
    }
  >(({ projectUuid, pipelineUuid }) => useTestHook(projectUuid, pipelineUuid), {
    wrapper,
    initialProps: { projectUuid: undefined, pipelineUuid: undefined },
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
      result.current.dispatch({
        type: "SET_PIPELINES",
        payload: mockData.project1Pipelines,
      });
    });

    rerender({ projectUuid: mockData.project1Uuid, pipelineUuid });

    expect(result.current.state.projectUuid).toEqual(mockData.project1Uuid);
    expect(result.current.state.pipelines).toEqual(mockData.project1Pipelines);
    expect(result.current.state.pipeline).toEqual(
      mockData.project1Pipelines[0]
    );
    expect(result.current.shouldShowAlert).toEqual(false);
    expect(navigateToMock.mock.calls.length).toEqual(1);
    expect(navigateToMock.mock.calls[0]).toEqual([
      mockData.project1Uuid,
      expectedPipeline.uuid,
      false,
    ]);
  };

  beforeEach(async () => {
    localStorage.clear();
    resetMock();

    rerender({ projectUuid: mockData.project1Uuid, pipelineUuid: undefined });

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

    rerender({
      projectUuid: mockData.project1Uuid,
      pipelineUuid: mockData.project1Pipelines[1].uuid,
    });

    expect(result.current.state.projectUuid).toEqual(mockData.project1Uuid);
    expect(result.current.state.pipelines).toEqual(mockData.project1Pipelines);
    expect(result.current.state.pipeline).toEqual(
      mockData.project1Pipelines[1]
    );
    expect(result.current.shouldShowAlert).toEqual(false);

    // Didn't redirect. This call is from loadProject1AfterMounted.
    expect(navigateToMock.mock.calls.length).toEqual(1);
  });

  it("should refetch pipelines when switching projects", async () => {
    await loadProject1AfterMounted(undefined, mockData.project1Pipelines[0]);

    act(() => {
      result.current.dispatch({
        type: "SET_PROJECT",
        payload: mockData.project2Uuid,
      });
      result.current.dispatch({
        type: "SET_PIPELINES",
        payload: mockData.project2Pipelines,
      });
    });

    rerender({ projectUuid: mockData.project2Uuid, pipelineUuid: undefined });

    expect(result.current.state.projectUuid).toEqual(mockData.project2Uuid);
    expect(result.current.state.projectUuid).toEqual(mockData.project2Uuid);
    expect(result.current.state.pipelines).toEqual(mockData.project2Pipelines);
    expect(result.current.state.pipeline).toEqual(
      mockData.project2Pipelines[0]
    );

    expect(navigateToMock.mock.calls.length).toEqual(2);
    expect(navigateToMock.mock.calls[1]).toEqual([
      mockData.project2Uuid,
      mockData.project2Pipelines[0].uuid,
      false,
    ]);
    expect(result.current.shouldShowAlert).toEqual(false);
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

    rerender({
      projectUuid: mockData.project1Uuid,
      pipelineUuid: newPipelineUuid,
    });

    expect(result.current.state.projectUuid).toEqual(mockData.project1Uuid);
    expect(result.current.state.pipelines).toEqual(
      listPipelineMetadata(mockData.project1Uuid)
    );
    expect(result.current.state.pipeline).toEqual(
      mockProjects.get(mockData.project1Uuid).pipelines.get(newPipelineUuid)
        .metadata
    );
    expect(result.current.state.newPipelineUuid).toEqual(newPipelineUuid);
    expect(result.current.shouldShowAlert).toEqual(false);

    expect(navigateToMock.mock.calls.length).toEqual(2);
    expect(navigateToMock.mock.calls[1]).toEqual([
      mockData.project1Uuid,
      newPipelineUuid,
      false,
    ]);
  });
});
