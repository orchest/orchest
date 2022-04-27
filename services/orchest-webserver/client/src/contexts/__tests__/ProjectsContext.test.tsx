import { act, renderHook } from "@testing-library/react-hooks";
import React from "react";
import {
  MOCK_PIPELINES,
  MOCK_PROJECT_ID_1,
  MOCK_PROJECT_ID_2,
} from "../../__mocks__/handlers.mock";
import {
  ProjectsContextProvider,
  useProjectsContext,
} from "../ProjectsContext";

const wrapper = ({ children }) => {
  return <ProjectsContextProvider>{children}</ProjectsContextProvider>;
};

describe("useProjectsContext", () => {
  const { result, waitForNextUpdate, rerender, unmount } = renderHook(
    () => useProjectsContext(),
    { wrapper }
  );

  beforeEach(async () => {
    rerender();

    // Before each case, MOCK_PROJECT_ID_1 should be loaded

    expect(result.current.state.projectUuid).toEqual(undefined);
    expect(result.current.state.pipelines).toEqual(undefined);
    expect(result.current.state.pipeline).toEqual(undefined);

    // Test case starts

    act(() => {
      // Temporarily not mocking the payload fully.
      result.current.dispatch({
        // @ts-ignore
        type: "SET_PROJECTS",
        // @ts-ignore
        payload: [{ uuid: MOCK_PROJECT_ID_1 }, { uuid: MOCK_PROJECT_ID_2 }],
      });
      result.current.dispatch({
        type: "SET_PROJECT",
        payload: MOCK_PROJECT_ID_1,
      });
    });

    // First render

    expect(result.current.state.projectUuid).toEqual(MOCK_PROJECT_ID_1);
    expect(result.current.state.pipelines).toEqual(undefined);
    expect(result.current.state.pipeline).toEqual(undefined);

    await waitForNextUpdate();

    expect(result.current.state.pipelines).toEqual(
      MOCK_PIPELINES[MOCK_PROJECT_ID_1]
    );

    expect(result.current.state.pipeline).toEqual(undefined);
  });

  afterEach(() => {
    unmount();
  });

  it("should clean up pipelines and pipeilne when changing project uuid", async () => {
    act(() => {
      result.current.dispatch({
        type: "SET_PROJECT",
        payload: MOCK_PROJECT_ID_2,
      });
    });

    expect(result.current.state.projectUuid).toEqual(MOCK_PROJECT_ID_2);
    expect(result.current.state.pipelines).toEqual(undefined);
    expect(result.current.state.pipeline).toEqual(undefined);
  });

  it("should refetch pipelines when changing project uuid", async () => {
    act(() => {
      result.current.dispatch({
        type: "SET_PROJECT",
        payload: MOCK_PROJECT_ID_2,
      });
    });

    expect(result.current.state.projectUuid).toEqual(MOCK_PROJECT_ID_2);
    expect(result.current.state.pipelines).toEqual(
      MOCK_PIPELINES[MOCK_PROJECT_ID_2]
    );
    expect(result.current.state.pipeline).toEqual(undefined);
  });

  it("should be able to switch pipeline by uuid", async () => {
    const pipelineUuid = `${MOCK_PROJECT_ID_1}-pipeline-2`;
    act(() => {
      result.current.dispatch({
        type: "UPDATE_PIPELINE",
        payload: { uuid: pipelineUuid },
      });
    });

    expect(result.current.state.projectUuid).toEqual(MOCK_PROJECT_ID_1);
    expect(result.current.state.pipelines).toEqual(
      MOCK_PIPELINES[MOCK_PROJECT_ID_1]
    );
    expect(result.current.state.pipeline).toEqual(
      MOCK_PIPELINES[MOCK_PROJECT_ID_1][1]
    );
  });

  it("should be able to update pipeline by uuid", async () => {
    const pipeline = MOCK_PIPELINES[MOCK_PROJECT_ID_1][0];

    act(() => {
      result.current.dispatch({
        type: "UPDATE_PIPELINE",
        payload: {
          uuid: pipeline.uuid,
          path: "new-path.orchest",
          name: "New Name",
        },
      });
    });

    expect(result.current.state.projectUuid).toEqual(MOCK_PROJECT_ID_1);
    expect(result.current.state.pipeline).toEqual({
      uuid: pipeline.uuid,
      path: "new-path.orchest",
      name: "New Name",
    });
  });
});
