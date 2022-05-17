import { AppContextProvider, useAppContext } from "@/contexts/AppContext";
import { ProjectsContextProvider } from "@/contexts/ProjectsContext";
import { envVariablesDictToArray } from "@/utils/webserver-utils";
import { chance } from "@/__mocks__/common.mock";
import { mockProjects } from "@/__mocks__/mockProjects.mock";
import { server } from "@/__mocks__/server.mock";
import { act, renderHook } from "@testing-library/react-hooks";
import * as React from "react";
import { useFetchPipelineSettings } from "../useFetchPipelineSettings";

const wrapper = ({ children = null, shouldStart }) => {
  return (
    <AppContextProvider shouldStart={shouldStart}>
      <ProjectsContextProvider>{children}</ProjectsContextProvider>;
    </AppContextProvider>
  );
};

const useTestHook = (props: {
  projectUuid: string | undefined;
  pipelineUuid: string | undefined;
  jobUuid: string | undefined;
  runUuid: string | undefined;
  isBrowserTabFocused: boolean;
}) => {
  const {
    state: { hasUnsavedChanges },
  } = useAppContext();
  const values = useFetchPipelineSettings(props);
  return { ...values, hasUnsavedChanges };
};

describe("useFetchPipelineSettings", () => {
  const { result, waitForNextUpdate, rerender, unmount } = renderHook<
    {
      children?: null;
      shouldStart: boolean;
      projectUuid: string | undefined;
      pipelineUuid: string | undefined;
      jobUuid: string | undefined;
      runUuid: string | undefined;
      isBrowserTabFocused: boolean;
    },
    ReturnType<typeof useFetchPipelineSettings> & { hasUnsavedChanges: boolean }
  >(({ children, ...props }) => useTestHook(props), {
    wrapper,
    initialProps: {
      shouldStart: false,
      projectUuid: undefined,
      pipelineUuid: undefined,
      jobUuid: undefined,
      runUuid: undefined,
      isBrowserTabFocused: false,
    },
  });

  beforeEach(async () => {
    mockProjects.reset();
  });

  it("should fetch pipeline settings", async () => {
    const mockProjectUuid = chance.guid();
    const mockPipelineUuid = chance.guid();

    const project = mockProjects.get(mockProjectUuid).project;
    const pipeline = mockProjects
      .get(mockProjectUuid)
      .pipelines.get(mockPipelineUuid);

    rerender({
      shouldStart: true,
      projectUuid: mockProjectUuid,
      pipelineUuid: mockPipelineUuid,
      jobUuid: undefined,
      runUuid: undefined,
      isBrowserTabFocused: true,
    });

    await waitForNextUpdate();

    expect(result.current.pipelineName).toEqual(pipeline.metadata.name);
    expect(result.current.pipelinePath).toEqual(pipeline.metadata.path);
    expect(result.current.pipelineJson).toEqual(pipeline.definition);

    expect(Object.values(result.current.services)).toEqual(
      Object.values(pipeline.definition.services || {})
    );

    expect(result.current.projectEnvVariables).toEqual(
      envVariablesDictToArray(project.env_variables)
    );

    expect(result.current.envVariables).toEqual(
      envVariablesDictToArray(pipeline.pipeline.env_variables)
    );

    expect(result.current.inputParameters).toEqual(
      JSON.stringify(pipeline.definition.parameters)
    );

    expect(result.current.hasUnsavedChanges).toEqual(false);
  });

  it(`should refresh pipeline settings if 
      - the pipeline is not read-only
      - regaining browser tab focus 
      - no unsaved changes`, async () => {
    const mockProjectUuid = chance.guid();
    const mockPipelineUuid = chance.guid();

    mockProjects.get(mockProjectUuid).project;
    const pipeline = mockProjects
      .get(mockProjectUuid)
      .pipelines.get(mockPipelineUuid);

    rerender({
      shouldStart: true,
      projectUuid: mockProjectUuid,
      pipelineUuid: mockPipelineUuid,
      jobUuid: undefined,
      runUuid: undefined,
      isBrowserTabFocused: true,
    });

    await waitForNextUpdate();

    expect(result.current.pipelineName).toEqual(pipeline.metadata.name);
    expect(result.current.pipelinePath).toEqual(pipeline.metadata.path);
    expect(result.current.hasUnsavedChanges).toEqual(false);

    // Lose browser tab focus.
    rerender({
      shouldStart: true,
      projectUuid: mockProjectUuid,
      pipelineUuid: mockPipelineUuid,
      jobUuid: undefined,
      runUuid: undefined,
      isBrowserTabFocused: false,
    });

    // Mutate the Mock API data
    mockProjects.set(mockProjectUuid, (projectData) => {
      projectData.pipelines.set(mockPipelineUuid, (currentPipeline) => {
        const newPipelineName = "New Pipeline Name";
        const newPipelinePath = "new-pipeline-name.orchest";
        return {
          ...currentPipeline,
          metadata: {
            ...currentPipeline.metadata,
            name: newPipelineName,
            path: newPipelinePath,
          },
          pipeline: { ...currentPipeline.pipeline, path: newPipelinePath },
          definition: {
            ...currentPipeline.definition,
            name: newPipelineName,
          },
        };
      });

      return projectData;
    });

    server.resetHandlers();

    expect(result.current.hasUnsavedChanges).toEqual(false);

    // Regain browser tab focus.
    rerender({
      shouldStart: true,
      projectUuid: mockProjectUuid,
      pipelineUuid: mockPipelineUuid,
      jobUuid: undefined,
      runUuid: undefined,
      isBrowserTabFocused: true,
    });

    await waitForNextUpdate();

    expect(result.current.pipelineName).toEqual("New Pipeline Name");
    expect(result.current.pipelinePath).toEqual("new-pipeline-name.orchest");
    expect(result.current.hasUnsavedChanges).toEqual(false);
  });

  it("should persist unsaved changes when browser tab regain focus.", async () => {
    const mockProjectUuid = chance.guid();
    const mockPipelineUuid = chance.guid();

    mockProjects.get(mockProjectUuid).project;
    mockProjects.get(mockProjectUuid).pipelines.get(mockPipelineUuid);

    rerender({
      shouldStart: true,
      projectUuid: mockProjectUuid,
      pipelineUuid: mockPipelineUuid,
      jobUuid: undefined,
      runUuid: undefined,
      isBrowserTabFocused: true,
    });

    await waitForNextUpdate();

    // Mutate the Mock API data
    mockProjects.set(mockProjectUuid, (projectData) => {
      projectData.pipelines.set(mockPipelineUuid, (currentPipeline) => {
        const newPipelineName = "New Pipeline Name";
        const newPipelinePath = "new-pipeline-name.orchest";
        return {
          ...currentPipeline,
          metadata: {
            ...currentPipeline.metadata,
            name: newPipelineName,
            path: newPipelinePath,
          },
          pipeline: { ...currentPipeline.pipeline, path: newPipelinePath },
          definition: {
            ...currentPipeline.definition,
            name: newPipelineName,
          },
        };
      });

      return projectData;
    });

    server.resetHandlers();

    expect(result.current.hasUnsavedChanges).toEqual(false);

    // Update states manually

    act(() => {
      result.current.setPipelineName("Another New Pipeline Name");
      result.current.setPipelinePath("another-new-pipeline-name.orchest");
    });

    expect(result.current.pipelineName).toEqual("Another New Pipeline Name");
    expect(result.current.pipelinePath).toEqual(
      "another-new-pipeline-name.orchest"
    );
    expect(result.current.hasUnsavedChanges).toEqual(true);

    // Lose browser tab focus.
    rerender({
      shouldStart: true,
      projectUuid: mockProjectUuid,
      pipelineUuid: mockPipelineUuid,
      jobUuid: undefined,
      runUuid: undefined,
      isBrowserTabFocused: false,
    });

    // Regain browser tab focus.
    // The unsaved changes should stay.
    rerender({
      shouldStart: true,
      projectUuid: mockProjectUuid,
      pipelineUuid: mockPipelineUuid,
      jobUuid: undefined,
      runUuid: undefined,
      isBrowserTabFocused: true,
    });

    expect(result.current.pipelineName).toEqual("Another New Pipeline Name");
    expect(result.current.pipelinePath).toEqual(
      "another-new-pipeline-name.orchest"
    );
    expect(result.current.hasUnsavedChanges).toEqual(true);
  });
});
