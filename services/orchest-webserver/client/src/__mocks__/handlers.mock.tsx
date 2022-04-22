import Chance from "chance";
import { rest } from "msw";
import type { PipelineJson, PipelineMetaData, Step } from "../types";

export const chance = new Chance();

type MockPipelineData = {
  metadata: PipelineMetaData;
  definition: PipelineJson;
};

type MockProjectData = {
  pipelines: {
    get(pipelineUuid: string): MockPipelineData;
    getAll(): Record<string, MockPipelineData>;
  };
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

const generateMockPipelineData = (pipelineUuid?: string): MockPipelineData => {
  const pipelineName = chance.name();
  const uuid = pipelineUuid || chance.guid();
  return {
    metadata: {
      uuid,
      path: `${pipelineName.toLowerCase().replace(/ /g, "-")}.orchest`,
      name: pipelineName,
    },
    definition: generatePipelineDefinition(uuid, pipelineName),
  };
};

const generateMockPipelineCollection = () => {
  const collection: Record<string, MockPipelineData> = {};

  return {
    get(pipelineUuid: string) {
      if (collection[pipelineUuid]) return collection[pipelineUuid];
      collection[pipelineUuid] = generateMockPipelineData(pipelineUuid);
      return collection[pipelineUuid];
    },
    getAll() {
      return collection;
    },
  };
};

const generateMockProjectCollection = () => {
  const collection: Record<string, MockProjectData> = {};
  return {
    get(projectUuid: string) {
      if (collection[projectUuid]) return collection[projectUuid];
      collection[projectUuid] = { pipelines: generateMockPipelineCollection() };
      return collection[projectUuid];
    },
  };
};

export const getPipelineMedadatas = (projectUuid: string) =>
  Object.values(mockProjectCollection.get(projectUuid).pipelines.getAll()).map(
    (pipelineData) => pipelineData.metadata
  );

export const mockProjectCollection = generateMockProjectCollection();

export const handlers = [
  rest.get("/async/server-config", (req, res, ctx) => {
    return res(
      ctx.json({
        config: {
          CLOUD: false,
          CLOUD_UNMODIFIABLE_CONFIG_VALUES: [
            "TELEMETRY_UUID",
            "TELEMETRY_DISABLED",
            "AUTH_ENABLED",
            "INTERCOM_USER_EMAIL",
          ],
          ENVIRONMENT_DEFAULTS: {
            base_image: "orchest/base-kernel-py:v2022.04.0",
            gpu_support: false,
            language: "python",
            name: "Python 3",
            setup_script:
              "#!/bin/bash\n\n# Install any dependencies you have in this shell script,\n# see https://docs.orchest.io/en/latest/fundamentals/environments.html#install-packages\n\n# E.g. mamba install -y tensorflow\n\n",
          },
          FLASK_ENV: "development",
          GPU_ENABLED_INSTANCE: false,
          INTERCOM_APP_ID: chance.guid(),
          INTERCOM_DEFAULT_SIGNUP_DATE: "1577833200",
          ORCHEST_SOCKETIO_ENV_IMG_BUILDING_NAMESPACE:
            "/environment_image_builds",
          ORCHEST_SOCKETIO_JUPYTER_IMG_BUILDING_NAMESPACE:
            "/jupyter_image_builds",
          ORCHEST_WEB_URLS: {
            github: "https://github.com/orchest/orchest",
            orchest_examples_json:
              "https://raw.githubusercontent.com/orchest/orchest-examples/main/orchest_examples_data.json",
            orchest_examples_repo:
              "https://github.com/orchest/orchest-examples",
            orchest_update_info_json:
              "https://update-info.orchest.io/api/orchest/update-info/v2?version=v2022.04.0",
            readthedocs: "https://docs.orchest.io/en/stable",
            slack:
              "https://join.slack.com/t/orchest/shared_invite/zt-g6wooj3r-6XI8TCWJrXvUnXKdIKU_8w",
            website: "https://www.orchest.io",
          },
          PIPELINE_PARAMETERS_RESERVED_KEY: "pipeline_parameters",
          TELEMETRY_DISABLED: true,
        },
        user_config: {
          AUTH_ENABLED: false,
          INTERCOM_USER_EMAIL: chance.email(),
          MAX_INTERACTIVE_RUNS_PARALLELISM: 1,
          MAX_JOB_RUNS_PARALLELISM: 1,
          TELEMETRY_DISABLED: true,
          TELEMETRY_UUID: chance.guid(),
        },
      })
    );
  }),
  rest.get(`/async/pipelines/:projectUuid`, (req, res, ctx) => {
    const projectUuid = req.params.projectUuid as string;
    if (!projectUuid) return res(ctx.status(404));

    const pipelines = getPipelineMedadatas(projectUuid);

    return res(ctx.json({ result: pipelines }));
  }),
  rest.get(
    `/async/pipelines/json/:projectUuid/:pipelineUuid`,
    (req, res, ctx) => {
      const projectUuid = req.params.projectUuid as string;
      const pipelineUuid = req.params.pipelineUuid as string;

      if (!projectUuid || !pipelineUuid) return res(ctx.status(404));

      const pipelineJson = mockProjectCollection
        .get(pipelineUuid)
        .pipelines.get(pipelineUuid).definition;

      return res(
        ctx.json({
          success: true,
          pipeline_json: JSON.stringify(pipelineJson),
        })
      );
    }
  ),
];
