import { setOutgoingConnections } from "@/utils/webserver-utils";
import type {
  PipelineJson,
  PipelineJsonState,
  PipelineMetaData,
  PipelineState,
  Project,
  StepData,
} from "../types";
import { chance } from "./common.mock";

type MockPipelineData = {
  metadata: PipelineMetaData;
  pipeline: PipelineState;
  definition: PipelineJson;
};

export type MockProjectData = {
  pipelines: {
    get(pipelineUuid: string): MockPipelineData;
    set(
      pipelineUuid: string,
      setter: (prev: MockPipelineData) => MockPipelineData
    ): MockPipelineData;
    getAll(): Record<string, MockPipelineData>;
  };
  project: Project;
};

const generatePipelineDefinition = (
  pipelineUuid: string,
  pipelineName: string,
  stepCount = 2
): PipelineJsonState => {
  const stepsDataDict: Record<string, StepData> = {};

  let prevStepUUid = "";

  for (let i = 0; i < stepCount; i++) {
    const stepName = chance.name();
    const stepUuid = chance.guid();
    stepsDataDict[stepUuid] = {
      title: stepName,
      uuid: chance.guid(),
      incoming_connections: prevStepUUid ? [prevStepUUid] : [],
      file_path: `${stepName.toLowerCase().replace(/ /g, "-")}.ipynb`,
      kernel: {
        name: "python",
        display_name: "Python 3",
      },
      environment: chance.guid(),
      parameters: { [chance.string()]: chance.string() },
      meta_data: {
        position: [
          chance.floating({ min: 0, max: 100 }),
          chance.floating({ min: 0, max: 100 }),
        ],
        hidden: false,
      },
    };
    prevStepUUid = stepUuid;
  }

  return {
    name: pipelineName,
    parameters: {},
    settings: {
      auto_eviction: false,
      data_passing_memory_size: "1GB",
    },
    steps: setOutgoingConnections(stepsDataDict),
    uuid: pipelineUuid,
    version: "1.2.0",
    services: {
      vscode: {
        args:
          "-c 'umask 002 && code-server --auth none --bind-addr 0.0.0.0:8080 /home/coder/code-server'",
        binds: { "/project-dir": "/home/coder/code-server" },
        command: "bash",
        env_variables: { [chance.string()]: chance.string() },
        exposed: true,
        image: "codercom/code-server:latest",
        name: "vscode",
        order: 1,
        ports: [8080],
        requires_authentication: true,
        scope: ["interactive"],
      },
    },
  };
};

const generateMockPipelineData = (
  projectUuid: string,
  pipelineUuid?: string
): MockPipelineData => {
  const pipelineName = chance.name();
  const uuid = pipelineUuid || chance.guid();
  const path = `${pipelineName.toLowerCase().replace(/ /g, "-")}.orchest`;
  return {
    metadata: {
      uuid,
      path,
      name: pipelineName,
      project_uuid: projectUuid,
    },
    pipeline: {
      env_variables: { [chance.string()]: chance.string() },
      name: pipelineName,
      path,
      project_uuid: projectUuid,
      status: "READY",
      uuid,
    },
    definition: generatePipelineDefinition(uuid, pipelineName),
  };
};

const generateMockPipelineCollection = (projectUuid: string) => {
  const collection: Record<string, MockPipelineData> = {};

  return {
    get(pipelineUuid: string) {
      if (collection[pipelineUuid]) return collection[pipelineUuid];
      collection[pipelineUuid] = generateMockPipelineData(
        projectUuid,
        pipelineUuid
      );

      return collection[pipelineUuid];
    },
    set(pipelineUuid: string, setter: (MockPipelineData) => MockPipelineData) {
      const targetPipeline =
        collection[pipelineUuid] ||
        generateMockPipelineData(projectUuid, pipelineUuid);

      collection[pipelineUuid] = setter(targetPipeline);
      return collection[pipelineUuid];
    },
    getAll() {
      return collection;
    },
  };
};

const generateMockProjectData = (projectUuid: string): Project => {
  // NOTE: most of the values are not used, so we only put dummy values only for testing
  // Use `mockProjects.set` to update the values depending on your test case,
  // e.g. if you create a new pipeline in your test case and you need to verify `pipeline_count`.

  return {
    uuid: projectUuid,
    path: "dummy-project",
    pipeline_count: 1,
    active_job_count: 1,
    environment_count: 1,
    project_snapshot_size: 30, // used
    env_variables: { [chance.string()]: chance.string() }, // used
    status: "READY",
    session_count: 1,
  };
};

let projectCollection: Record<string, MockProjectData> = {};

export const generateMockProjectCollection = () => {
  return {
    get(projectUuid: string) {
      if (projectCollection[projectUuid]) return projectCollection[projectUuid];

      projectCollection[projectUuid] = {
        project: generateMockProjectData(projectUuid),
        pipelines: generateMockPipelineCollection(projectUuid),
      };
      return projectCollection[projectUuid];
    },
    set(
      projectUuid: string,
      setter: (MockProjectData: MockProjectData) => MockProjectData
    ) {
      const project = projectCollection[projectUuid] || {
        project: generateMockProjectData(projectUuid),
        pipelines: generateMockPipelineCollection(projectUuid),
      };

      projectCollection[projectUuid] = setter(project);
      return projectCollection[projectUuid];
    },
    getAll() {
      return projectCollection;
    },
    reset() {
      projectCollection = {};
    },
  };
};

export const mockProjects = generateMockProjectCollection();

export const listPipelineMetadata = (projectUuid: string) =>
  Object.values(mockProjects.get(projectUuid).pipelines.getAll()).map(
    (pipelineData) => pipelineData.metadata
  );
