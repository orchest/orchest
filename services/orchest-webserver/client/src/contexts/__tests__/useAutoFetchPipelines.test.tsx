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
import { act, renderHook } from "@testing-library/react-hooks";
import * as React from "react";
import { useAutoFetchPipelines } from "../useAutoFetchPipelines";

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

const wrapper = ({ children = null }) => {
  return <ProjectsContextProvider>{children}</ProjectsContextProvider>;
};

const useTestHook = (
  projectUuid: string | undefined,
  pipelineUuid: string | undefined
) => {
  const { state, dispatch } = useProjectsContext();
  const fetchedPipelines = useAutoFetchPipelines(projectUuid, pipelineUuid);

  return { state, dispatch, fetchedPipelines };
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

describe("useAutoFetchPipelines", () => {
  const { result, waitForNextUpdate, rerender, unmount } = renderHook<
    {
      children?: null;
      projectUuid?: string;
      pipelineUuid?: string;
    },
    {
      state: IProjectsContextState;
      dispatch: (value: ProjectsContextAction) => void;
      fetchedPipelines: PipelineMetaData[] | undefined;
    }
  >(({ projectUuid, pipelineUuid }) => useTestHook(projectUuid, pipelineUuid), {
    wrapper,
    initialProps: {},
  });

  const loadProject1AfterMounted = async (pipelineUuid: string | undefined) => {
    act(() => {
      result.current.dispatch({
        type: "SET_PROJECT",
        payload: mockData.project1Uuid,
      });
    });

    rerender({ projectUuid: mockData.project1Uuid, pipelineUuid });

    expect(result.current.state.projectUuid).toEqual(mockData.project1Uuid);
    expect(result.current.state.pipelines).toEqual(undefined);
    expect(result.current.state.pipeline).toEqual(undefined);
    expect(result.current.fetchedPipelines).toEqual(undefined);
    expect(result.current.state.hasLoadedPipelinesInPipelineEditor).toEqual(
      false
    );

    await waitForNextUpdate();

    expect(result.current.state.projectUuid).toEqual(mockData.project1Uuid);
    expect(result.current.state.pipelines).toEqual(mockData.project1Pipelines);
    expect(result.current.state.pipeline).toEqual(undefined);
    expect(result.current.fetchedPipelines).toEqual(mockData.project1Pipelines);
    expect(result.current.state.hasLoadedPipelinesInPipelineEditor).toEqual(
      true
    );
  };

  beforeEach(async () => {
    localStorage.clear();
    resetMock();

    rerender({ projectUuid: undefined, pipelineUuid: undefined });

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

  it("should do nothing if project UUID is undefined", async () => {
    rerender();

    expect(result.current.state.projectUuid).toEqual(undefined);
    expect(result.current.state.pipelines).toEqual(undefined);
    expect(result.current.state.pipeline).toEqual(undefined);
    expect(result.current.fetchedPipelines).toEqual(undefined);
    expect(result.current.state.hasLoadedPipelinesInPipelineEditor).toEqual(
      false
    );
  });

  it("should load the pipelines if project UUID is given, but pipeline UUID is undefined", async () => {
    await loadProject1AfterMounted(undefined);
  });

  it("should fetch the pipelines if both project UUID abd pipeline UUID are given", async () => {
    await loadProject1AfterMounted(undefined);

    rerender({
      projectUuid: mockData.project1Uuid,
      pipelineUuid: mockData.project1Pipelines[1].uuid,
    });

    expect(result.current.state.projectUuid).toEqual(mockData.project1Uuid);
    expect(result.current.state.pipelines).toEqual(mockData.project1Pipelines);
    expect(result.current.state.pipeline).toEqual(undefined);
    expect(result.current.fetchedPipelines).toEqual(mockData.project1Pipelines);
    expect(result.current.state.hasLoadedPipelinesInPipelineEditor).toEqual(
      true
    );
  });

  it("should fetch the pipelines if pipeline UUID is invalid", async () => {
    await loadProject1AfterMounted(undefined);

    rerender({
      projectUuid: mockData.project1Uuid,
      pipelineUuid: "invalid-uuid",
    });

    expect(result.current.state.projectUuid).toEqual(mockData.project1Uuid);
    expect(result.current.state.pipelines).toEqual(mockData.project1Pipelines);
    expect(result.current.state.pipeline).toEqual(undefined);
    expect(result.current.fetchedPipelines).toEqual(mockData.project1Pipelines);
    expect(result.current.state.hasLoadedPipelinesInPipelineEditor).toEqual(
      true
    );
  });

  it(`should re-fetch the pipelines if project UUID is changed`, async () => {
    await loadProject1AfterMounted(mockData.project1Pipelines[1].uuid);

    rerender({
      projectUuid: mockData.project2Uuid,
      pipelineUuid: undefined,
    });

    act(() => {
      result.current.dispatch({
        type: "SET_PROJECT",
        payload: mockData.project2Uuid,
      });
    });

    rerender({ projectUuid: mockData.project2Uuid, pipelineUuid: undefined });

    expect(result.current.state.projectUuid).toEqual(mockData.project2Uuid);
    expect(result.current.state.pipelines).toEqual(undefined);
    expect(result.current.state.pipeline).toEqual(undefined);
    expect(result.current.fetchedPipelines).toEqual(undefined);
    expect(result.current.state.hasLoadedPipelinesInPipelineEditor).toEqual(
      false
    );

    await waitForNextUpdate();

    expect(result.current.state.projectUuid).toEqual(mockData.project2Uuid);
    expect(result.current.state.pipelines).toEqual(mockData.project2Pipelines);
    expect(result.current.state.pipeline).toEqual(undefined);
    expect(result.current.fetchedPipelines).toEqual(mockData.project2Pipelines);
    expect(result.current.state.hasLoadedPipelinesInPipelineEditor).toEqual(
      true
    );
  });
});
