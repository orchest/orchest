import { rest } from "msw";
import {
  chance,
  getPipelineMedadatas,
  mockProjects,
} from "./mockProjects.mock";

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
              "https://update-info.orchest.io/api/orchest/update-info/v3?version=v2022.04.0",
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
  rest.get(`/async/projects`, (req, res, ctx) => {
    const projectCollection = mockProjects.getAll();

    const projects = Object.values(projectCollection).map(
      (collection) => collection.project
    );

    return res(ctx.json(projects));
  }),
  rest.get(`/async/projects/:projectUuid`, (req, res, ctx) => {
    const projectUuid = req.params.projectUuid as string;
    if (!projectUuid) return res(ctx.status(404));

    const project = mockProjects.get(projectUuid).project;

    return res(ctx.json(project));
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

      const pipelineJson = mockProjects
        .get(projectUuid)
        .pipelines.get(pipelineUuid).definition;

      return res(
        ctx.json({
          success: true,
          pipeline_json: JSON.stringify(pipelineJson),
        })
      );
    }
  ),
  rest.get(`/async/pipelines/:projectUuid/:pipelineUuid`, (req, res, ctx) => {
    const projectUuid = req.params.projectUuid as string;
    const pipelineUuid = req.params.pipelineUuid as string;

    if (!projectUuid || !pipelineUuid) return res(ctx.status(404));

    const pipeline = mockProjects.get(projectUuid).pipelines.get(pipelineUuid)
      .pipeline;

    return res(ctx.json(pipeline));
  }),
];
