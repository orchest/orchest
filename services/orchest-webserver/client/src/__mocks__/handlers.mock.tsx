import { rest } from "msw";
import { mockConfig } from "./mockConfig.mock";
import { getPipelineMedadatas, mockProjects } from "./mockProjects.mock";

export const handlers = [
  rest.get("/async/user-config", (req, res, ctx) => {
    return res(
      ctx.json({
        user_config: mockConfig.get().user_config,
      })
    );
  }),
  rest.get("/async/server-config", (req, res, ctx) => {
    return res(ctx.json(mockConfig.get()));
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
