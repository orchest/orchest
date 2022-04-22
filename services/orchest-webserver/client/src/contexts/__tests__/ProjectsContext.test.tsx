import { act, renderHook } from "@testing-library/react-hooks";
import React from "react";
import {
  chance,
  getPipelineMedadatas,
  mockProjectCollection,
} from "../../__mocks__/handlers.mock";
import {
  ProjectsContextProvider,
  useProjectsContext,
} from "../ProjectsContext";

const wrapper = ({ children }) => {
  return <ProjectsContextProvider>{children}</ProjectsContextProvider>;
};

describe("useProjectsContext", () => {
  // Create mock data

  const project1Uuid = chance.guid();
  const project2Uuid = chance.guid();

  for (let i = 0; i < 2; i++) {
    mockProjectCollection.get(project1Uuid).pipelines.get(chance.guid());
    mockProjectCollection.get(project2Uuid).pipelines.get(chance.guid());
  }

  const project1Pipelines = getPipelineMedadatas(project1Uuid);
  const project2Pipelines = getPipelineMedadatas(project2Uuid);

  const { result, waitForNextUpdate, rerender, unmount } = renderHook(
    () => useProjectsContext(),
    { wrapper }
  );

  beforeEach(async () => {
    rerender();

    // Before each case, MOCK_PROJECT_1_ID should be loaded

    expect(result.current.state.projectUuid).toEqual(undefined);
    expect(result.current.state.pipelines).toEqual(undefined);
    expect(result.current.state.pipeline).toEqual(undefined);

    // Test case starts

    act(() => {
      result.current.dispatch({
        type: "SET_PROJECT",
        payload: project1Uuid,
      });
    });

    // First render

    expect(result.current.state.projectUuid).toEqual(project1Uuid);
    expect(result.current.state.pipelines).toEqual(undefined);
    expect(result.current.state.pipeline).toEqual(undefined);

    await waitForNextUpdate();

    expect(result.current.state.pipelines).toEqual(project1Pipelines);

    expect(result.current.state.pipeline).toEqual(undefined);
  });

  afterEach(() => {
    unmount();
  });

  it("should clean up pipelines and pipeilne when changing project uuid", async () => {
    act(() => {
      result.current.dispatch({
        type: "SET_PROJECT",
        payload: project2Uuid,
      });
    });

    expect(result.current.state.projectUuid).toEqual(project2Uuid);
    expect(result.current.state.pipelines).toEqual(undefined);
    expect(result.current.state.pipeline).toEqual(undefined);
  });

  it("should refetch pipelines when changing project uuid", async () => {
    act(() => {
      result.current.dispatch({
        type: "SET_PROJECT",
        payload: project2Uuid,
      });
    });

    expect(result.current.state.projectUuid).toEqual(project2Uuid);
    expect(result.current.state.pipelines).toEqual(project2Pipelines);
    expect(result.current.state.pipeline).toEqual(undefined);
  });

  it("should be able to switch pipeline by uuid", async () => {
    const pipeline = project1Pipelines[1];
    const pipelineUuid = pipeline.uuid;
    act(() => {
      result.current.dispatch({
        type: "UPDATE_PIPELINE",
        payload: { uuid: pipelineUuid },
      });
    });

    expect(result.current.state.projectUuid).toEqual(project1Uuid);
    expect(result.current.state.pipelines).toEqual(project1Pipelines);
    expect(result.current.state.pipeline).toEqual(pipeline);
  });

  it("should be able to update pipeline by uuid", async () => {
    const pipeline = project1Pipelines[0];

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

    expect(result.current.state.projectUuid).toEqual(project1Uuid);
    expect(result.current.state.pipeline).toEqual({
      uuid: pipeline.uuid,
      path: "new-name.orchest",
      name: "New Name",
    });
  });
});
