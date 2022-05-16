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
  const { result, waitForNextUpdate, rerender, unmount } = renderHook<
    {
      children?: null;
      pipelineUuid: string | undefined;
    },
    {
      state: IProjectsContextState;
      dispatch: (value: ProjectsContextAction) => void;
    }
  >(({ pipelineUuid }) => useTestHook(pipelineUuid), {
    wrapper,
    initialProps: {
      pipelineUuid: undefined,
    },
  });

  const loadProject1AfterMounted = async () => {
    act(() => {
      result.current.dispatch({
        type: "SET_PROJECT",
        payload: mockData.project1Uuid,
      });
    });

    expect(result.current.state.projectUuid).toEqual(mockData.project1Uuid);
    expect(result.current.state.pipelines).toEqual(undefined);
    expect(result.current.state.pipeline).toEqual(undefined);

    await waitForNextUpdate();

    expect(navigateToMock.mock.calls.length).toEqual(1);
    expect(navigateToMock.mock.calls[0]).toEqual([
      siteMap.pipeline.path,
      {
        query: {
          projectUuid: mockData.project1Uuid,
          pipelineUuid: mockData.project1Pipelines[0].uuid,
        },
      },
    ]);
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
    await loadProject1AfterMounted();
  });

  it("should navigate to the first pipeline from the pipelines if pipelineUuid is invalid", async () => {
    await loadProject1AfterMounted();
    rerender({ pipelineUuid: "invalid-pipeline-uuid" });
    expect(navigateToMock.mock.calls.length).toEqual(2);
    expect(navigateToMock.mock.calls[1]).toEqual([
      siteMap.pipeline.path,
      {
        query: {
          projectUuid: mockData.project1Uuid,
          pipelineUuid: mockData.project1Pipelines[0].uuid,
        },
      },
    ]);
  });

  it("should refetch pipelines when switching projects", async () => {
    await loadProject1AfterMounted();
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

    rerender({ pipelineUuid: undefined });

    // await the async fetch update
    await waitForNextUpdate();

    expect(result.current.state.projectUuid).toEqual(mockData.project2Uuid);
    expect(result.current.state.pipelines).toEqual(mockData.project2Pipelines);
    expect(result.current.state.pipeline).toEqual(undefined);
    // navigate to the first pipeline of project 2.
    expect(navigateToMock.mock.calls.length).toEqual(2);
    expect(navigateToMock.mock.calls[1]).toEqual([
      siteMap.pipeline.path,
      {
        query: {
          projectUuid: mockData.project2Uuid,
          pipelineUuid: mockData.project2Pipelines[0].uuid,
        },
      },
    ]);
  });

  it("should navigate to the last-seen pipeline if pipelineUuid is undefined", async () => {
    await loadProject1AfterMounted();
    // projectUuid is already set to mockData.project1Uuid
    // Load project1Pipelines[1], which is NOT the first pipeline in the list
    rerender({ pipelineUuid: mockData.project1Pipelines[1].uuid });

    expect(result.current.state.projectUuid).toEqual(mockData.project1Uuid);
    expect(result.current.state.pipelines).toEqual(mockData.project1Pipelines);
    expect(result.current.state.pipeline).toEqual(
      mockData.project1Pipelines[1]
    );

    // Load project1Pipelines[2], which is NOT the first pipeline in the list
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

    // Finally, persisted the non-default pipeline for project 1 and 2.
    // Unset `pipelineUuid` to see if it attempts to navigate to the persisted pipelines.
    rerender({ pipelineUuid: undefined });

    // Test case starts.

    // Switch back to project 1
    act(() => {
      result.current.dispatch({
        type: "SET_PROJECT",
        payload: mockData.project1Uuid,
      });
    });

    // Should attempt to load the persisted pipeline
    expect(navigateToMock.mock.calls.length).toEqual(2);
    expect(navigateToMock.mock.calls[1]).toEqual([
      siteMap.pipeline.path,
      {
        query: {
          projectUuid: mockData.project1Uuid,
          pipelineUuid: mockData.project1Pipelines[1].uuid,
        },
      },
    ]);

    await waitForNextUpdate();

    // Switch to project 2 again
    act(() => {
      result.current.dispatch({
        type: "SET_PROJECT",
        payload: mockData.project2Uuid,
      });
    });

    // Should attempt to load the persisted pipeline
    expect(navigateToMock.mock.calls.length).toEqual(3);
    expect(navigateToMock.mock.calls[2]).toEqual([
      siteMap.pipeline.path,
      {
        query: {
          projectUuid: mockData.project2Uuid,
          pipelineUuid: mockData.project2Pipelines[1].uuid,
        },
      },
    ]);
  });
});
