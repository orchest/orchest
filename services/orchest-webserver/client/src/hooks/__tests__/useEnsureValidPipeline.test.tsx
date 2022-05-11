import {
  IProjectsContextState,
  ProjectsContextAction,
  ProjectsContextProvider,
  useProjectsContext,
} from "@/contexts/ProjectsContext";
import type { NavigateParams } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import { PipelineMetaData } from "@/types";
import { chance } from "@/__mocks__/common.mock";
import {
  getPipelineMedadatas,
  mockProjects,
} from "@/__mocks__/mockProjects.mock";
import { act, renderHook } from "@testing-library/react-hooks";
import * as React from "react";
import { SWRConfig } from "swr";
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
  (path: string, params?: NavigateParams | undefined) => undefined
);

const wrapper = ({ children = null }) => {
  return (
    <SWRConfig value={{ provider: () => new Map() }}>
      <ProjectsContextProvider>{children}</ProjectsContextProvider>;
    </SWRConfig>
  );
};

const useTestHook = (
  projectUuidFromRoute: string | undefined,
  pipelineUuid: string | undefined
) => {
  const { state, dispatch } = useProjectsContext();
  const shouldShowAlert = useEnsureValidPipelineBase(
    navigateToMock,
    projectUuidFromRoute,
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
  const { result, waitForNextUpdate, rerender, unmount } = renderHook<
    {
      children?: null;
      projectUuid: string | undefined;
      pipelineUuid: string | undefined;
    },
    {
      state: IProjectsContextState;
      dispatch: (value: ProjectsContextAction) => void;
    }
  >(({ projectUuid, pipelineUuid }) => useTestHook(projectUuid, pipelineUuid), {
    wrapper,
    initialProps: {
      projectUuid: undefined,
      pipelineUuid: undefined,
    },
  });

  beforeEach(async () => {
    resetMock();

    rerender({ projectUuid: undefined, pipelineUuid: undefined });

    expect(result.current.state.projectUuid).toEqual(undefined);
    expect(result.current.state.pipelines).toEqual(undefined);
    expect(result.current.state.pipeline).toEqual(undefined);

    // Before each test case, check if it load the first pipeline of the given project `mockData.project1Uuid`.

    act(() => {
      result.current.dispatch({
        type: "SET_PROJECTS",
        payload: [
          mockProjects.get(mockData.project1Uuid).project,
          mockProjects.get(mockData.project2Uuid).project,
        ],
      });
      result.current.dispatch({
        type: "SET_PROJECT",
        payload: mockData.project1Uuid,
      });
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    unmount();
  });

  it("should navigate to the first pipeline from the pipelines if pipelineUuid is undefined", async () => {
    rerender({ projectUuid: mockData.project1Uuid, pipelineUuid: undefined });

    // First render

    expect(result.current.state.projectUuid).toEqual(mockData.project1Uuid);
    expect(result.current.state.pipelines).toEqual(undefined);
    expect(result.current.state.pipeline).toEqual(undefined);

    await waitForNextUpdate();

    expect(result.current.state.pipelines).toEqual(mockData.project1Pipelines);
    expect(result.current.state.pipeline).toEqual(undefined);
    expect(navigateToMock.mock.calls.length).toEqual(1);
    // navigate to the first pipeline.
    expect(navigateToMock.mock.calls[0]).toEqual([
      siteMap.pipeline.path,
      {
        query: {
          projectUuid: mockData.project1Uuid,
          pipelineUuid: mockData.project1Pipelines[0].uuid,
        },
      },
    ]);
  });

  it("should refetch pipelines when changing project uuid", async () => {
    // Load project1 and project1Pipelines[1]
    rerender({
      projectUuid: mockData.project1Uuid,
      pipelineUuid: mockData.project1Pipelines[1].uuid,
    });

    await waitForNextUpdate();

    expect(result.current.state.projectUuid).toEqual(mockData.project1Uuid);
    expect(result.current.state.pipelines).toEqual(mockData.project1Pipelines);
    expect(result.current.state.pipeline).toEqual(
      mockData.project1Pipelines[1]
    );

    // Test case starts.

    act(() => {
      result.current.dispatch({
        type: "SET_PROJECT",
        payload: mockData.project2Uuid,
      });
    });

    // First render

    expect(result.current.state.projectUuid).toEqual(mockData.project2Uuid);
    expect(result.current.state.pipelines).toEqual(undefined);
    expect(result.current.state.pipeline).toEqual(undefined);

    rerender({ projectUuid: mockData.project2Uuid, pipelineUuid: undefined });

    // await the async fetch update
    await waitForNextUpdate();

    expect(result.current.state.projectUuid).toEqual(mockData.project2Uuid);
    expect(result.current.state.pipelines).toEqual(mockData.project2Pipelines);
    expect(result.current.state.pipeline).toEqual(undefined);
    expect(navigateToMock.mock.calls.length).toEqual(1);
    // navigate to the first pipeline.
    expect(navigateToMock.mock.calls[0]).toEqual([
      siteMap.pipeline.path,
      {
        query: {
          projectUuid: mockData.project2Uuid,
          pipelineUuid: mockData.project2Pipelines[0].uuid,
        },
      },
    ]);
  });
});
