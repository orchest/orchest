// src/handlers.js
import { rest } from "msw";
import type { PipelineMetaData } from "../types";

export const MOCK_PROJECT_ID_1 = "mock-project-id-1";
export const MOCK_PROJECT_ID_2 = "mock-project-id-2";

export const MOCK_PIPELINES: Record<string, PipelineMetaData[]> = {
  [MOCK_PROJECT_ID_1]: [
    {
      uuid: `${MOCK_PROJECT_ID_1}-pipeline-1`,
      path: "project_1_pipeline_1.orchest",
      name: "Project 1 Pipeline 1",
    },
    {
      uuid: `${MOCK_PROJECT_ID_1}-pipeline-2`,
      path: "project_1_pipeline_2.orchest",
      name: "Project 1 Pipeline 2",
    },
  ],
  [MOCK_PROJECT_ID_2]: [
    {
      uuid: `${MOCK_PROJECT_ID_2}-pipeline-1`,
      path: "project_2_pipeline_1.orchest",
      name: "Project 2 Pipeline 1",
    },
    {
      uuid: `${MOCK_PROJECT_ID_2}-pipeline-2`,
      path: "project_2_pipeline_2.orchest",
      name: "Project 2 Pipeline 2",
    },
  ],
};

export const handlers = [
  rest.get(`/async/pipelines/:projectUuid`, (req, res, ctx) => {
    const { projectUuid } = req.params;

    return res(ctx.json({ result: MOCK_PIPELINES[projectUuid as string] }));
  }),
];
