import Chance from "chance";
import type {
  Pipeline,
  PipelineJson,
  PipelineMetaData,
  Project,
  Step,
} from "../types";

export const chance = new Chance();

type MockPipelineData = {
  metadata: PipelineMetaData;
  pipeline: Pipeline;
  definition: PipelineJson;
};

type MockProjectData = {
  pipelines: {
    get(pipelineUuid: string): MockPipelineData;
    getAll(): Record<string, MockPipelineData>;
  };
  project: Project;
};

const generatePipelineDefinition = (
  pipelineUuid: string,
  pipelineName: string,
  stepCount = 2
): PipelineJson => {
  const stepsObj: Record<string, Step> = {};

  let prevStepUUid = "";

  for (let i = 0; i < stepCount; i++) {
    const stepName = chance.name();
    const stepUuid = chance.guid();
    stepsObj[stepUuid] = {
      title: stepName,
      uuid: chance.guid(),
      incoming_connections: prevStepUUid.length > 0 ? [prevStepUUid] : [],
      file_path: `${stepName.toLowerCase().replace(/ /g, "-")}.ipynb`,
      kernel: {
        name: "python",
        display_name: "Python 3",
      },
      environment: chance.guid(),
      parameters: {},
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
    steps: stepsObj,
    uuid: pipelineUuid,
    version: "1.2.0",
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
    },
    pipeline: {
      env_variables: { [chance.string()]: chance.string() },
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
    getAll() {
      return collection;
    },
  };
};

const generateMockProjectData = (projectUuid: string): Project => {
  // NOTE: most of the values are not used, so we only put dummy values only for testing
  // Use `mockProjectCollection.set` to update the values depending on your test case,
  // e.g. if you create a new pipeline in your test case and you need to verify `pipeline_count`.
  return {
    uuid: projectUuid,
    path: "dummy-project",
    pipeline_count: 1,
    job_count: 1,
    environment_count: 1,
    project_snapshot_size: 30, // used
    env_variables: { [chance.string()]: chance.string() }, // used
    status: "READY",
    session_count: 1,
  };
};

const generateMockProjectCollection = () => {
  let collection: Record<string, MockProjectData> = {};
  return {
    get(projectUuid: string) {
      if (collection[projectUuid]) return collection[projectUuid];
      collection[projectUuid] = {
        project: generateMockProjectData(projectUuid),
        pipelines: generateMockPipelineCollection(projectUuid),
      };
      return collection[projectUuid];
    },
    set(
      projectUuid: string,
      setter: (MockProjectData: MockProjectData) => MockProjectData
    ) {
      const project = collection[projectUuid] || {
        project: generateMockProjectData(projectUuid),
        pipelines: generateMockPipelineCollection(projectUuid),
      };

      collection[projectUuid] = setter(project);
      return collection[projectUuid];
    },
    reset() {
      collection = {};
    },
  };
};

export const getPipelineMedadatas = (projectUuid: string) =>
  Object.values(mockProjectCollection.get(projectUuid).pipelines.getAll()).map(
    (pipelineData) => pipelineData.metadata
  );

export const mockProjectCollection = generateMockProjectCollection();
