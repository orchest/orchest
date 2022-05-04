import { AppContextProvider, useAppContext } from "@/contexts/AppContext";
import { ProjectsContextProvider } from "@/contexts/ProjectsContext";
import { envVariablesDictToArray } from "@/utils/webserver-utils";
import { chance, mockProjects } from "@/__mocks__/mockProjects.mock";
import { server } from "@/__mocks__/server.mock";
import { act, renderHook } from "@testing-library/react-hooks";
import * as React from "react";
import { SWRConfig } from "swr";
import { useFetchPipelineSettings } from "../useFetchPipelineSettings";

describe("useFetchPipelineSettings", () => {
  const wrapper = ({ children }) => {
    return (
      <SWRConfig value={{ revalidateOnMount: true }}>
        <AppContextProvider>
          <ProjectsContextProvider>{children}</ProjectsContextProvider>;
        </AppContextProvider>
      </SWRConfig>
    );
  };

  const useTestHook = (props: {
    projectUuid: string | undefined;
    pipelineUuid: string | undefined;
    jobUuid: string | undefined;
    runUuid: string | undefined;
  }) => {
    const {
      state: { hasUnsavedChanges },
    } = useAppContext();
    const values = useFetchPipelineSettings(props);
    return { ...values, hasUnsavedChanges };
  };

  beforeEach(async () => {
    mockProjects.reset();
  });

  it("should fetch and update pipeline settings for a non-read-only pipeline", async () => {
    const mockProjectUuid = chance.guid();
    const mockPipelineUuid = chance.guid();

    const project = mockProjects.get(mockProjectUuid).project;
    const pipeline = mockProjects
      .get(mockProjectUuid)
      .pipelines.get(mockPipelineUuid);

    const { result, waitForNextUpdate } = renderHook(
      () =>
        useTestHook({
          projectUuid: mockProjectUuid,
          pipelineUuid: mockPipelineUuid,
          jobUuid: undefined,
          runUuid: undefined,
        }),
      { wrapper }
    );

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

    // Mutate the Mock API data

    mockProjects.set(mockProjectUuid, (projectData) => {
      const targetPipeline = projectData.pipelines.set(
        mockPipelineUuid,
        (currentPipeline) => {
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
        }
      );

      return projectData;
    });

    server.resetHandlers();

    // Simulate the scenario that SWR revalidates when browser tab regain focus when there's no unsaved changes.
    // This happens when user visits Pipeline Settings (value cached) and
    // then update the setting in other places, e.g. PipelineEditor
    // new values, instead of the cached values, should be filled in PipelineSettings.

    act(() => {
      // SWRConfig.revalidateOnMount not working as expected
      // manually refetch here.
      result.current.refetch();
    });

    await waitForNextUpdate();

    expect(result.current.pipelineName).toEqual("New Pipeline Name");
    expect(result.current.pipelinePath).toEqual("new-pipeline-name.orchest");
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

    // If states are updated and then refetch data, the states should stay.

    act(() => {
      result.current.refetch();
    });

    await waitForNextUpdate();

    expect(result.current.pipelineName).toEqual("Another New Pipeline Name");
    expect(result.current.pipelinePath).toEqual(
      "another-new-pipeline-name.orchest"
    );
    expect(result.current.hasUnsavedChanges).toEqual(true);
  });
});
