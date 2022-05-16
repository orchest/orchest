import { PipelineMetaData } from "@/types";
import { chance } from "@/__mocks__/common.mock";
import {
  getPipelineMedadatas,
  mockProjects,
} from "@/__mocks__/mockProjects.mock";
import { act, renderHook } from "@testing-library/react-hooks";
import * as React from "react";
import {
  ProjectsContextProvider,
  useProjectsContext,
} from "../ProjectsContext";

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

describe("useProjectsContext", () => {
  const wrapper = ({ children }) => {
    return <ProjectsContextProvider>{children}</ProjectsContextProvider>;
  };
  const { result, waitForNextUpdate, rerender, unmount } = renderHook(
    () => useProjectsContext(),
    { wrapper }
  );

  beforeEach(async () => {
    resetMock();
    rerender();

    // Before each case, load `mockData.project1Uuid` and `mockData.project1Pipelines`

    expect(result.current.state.projectUuid).toEqual(undefined);
    expect(result.current.state.pipelines).toEqual(undefined);
    expect(result.current.state.pipeline).toEqual(undefined);

    // Test case starts

    act(() => {
      result.current.dispatch({
        type: "SET_PROJECTS",
        payload: Object.values(mockProjects.getAll()).map(
          (collection) => collection.project
        ),
      });
      result.current.dispatch({
        type: "SET_PROJECT",
        payload: mockData.project1Uuid,
      });
      act(() => {
        result.current.dispatch({
          type: "SET_PIPELINES",
          payload: mockData.project1Pipelines,
        });
      });
    });

    expect(result.current.state.projectUuid).toEqual(mockData.project1Uuid);
    expect(result.current.state.pipelines).toEqual(mockData.project1Pipelines);
    expect(result.current.state.pipeline).toEqual(
      mockData.project1Pipelines[0]
    );
  });

  afterEach(() => {
    unmount();
  });

  it("should clean up pipelines and pipeilne when changing project uuid", async () => {
    act(() => {
      result.current.dispatch({
        type: "SET_PROJECT",
        payload: mockData.project2Uuid,
      });
    });

    expect(result.current.state.projectUuid).toEqual(mockData.project2Uuid);
    expect(result.current.state.pipelines).toEqual(undefined);
    expect(result.current.state.pipeline).toEqual(undefined);
  });

  it("should be able to switch pipeline by uuid", async () => {
    const pipeline = mockData.project1Pipelines[1];
    const pipelineUuid = pipeline.uuid;

    act(() => {
      result.current.dispatch({
        type: "UPDATE_PIPELINE",
        payload: { uuid: pipelineUuid },
      });
    });

    expect(result.current.state.projectUuid).toEqual(mockData.project1Uuid);
    expect(result.current.state.pipelines).toEqual(mockData.project1Pipelines);
    expect(result.current.state.pipeline).toEqual(pipeline);
  });

  it("should be able to update pipeline by uuid", async () => {
    const pipeline = mockData.project1Pipelines[0];

    act(() => {
      result.current.dispatch({
        type: "UPDATE_PIPELINE",
        payload: {
          uuid: pipeline.uuid,
          path: "new-name.orchest",
          name: "New Name",
        },
      });
    });

    expect(result.current.state.projectUuid).toEqual(mockData.project1Uuid);
    expect(result.current.state.pipeline).toEqual({
      uuid: pipeline.uuid,
      path: "new-name.orchest",
      name: "New Name",
    });
  });
});
