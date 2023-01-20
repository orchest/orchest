import { RouteLink } from "@/components/RouteLink";
import { useActiveStep } from "@/hooks/useActiveStep";
import {
  useCurrentQuery,
  useNavigate,
  useRouteLink,
} from "@/hooks/useCustomRoute";
import { useFetchActiveJob } from "@/hooks/useFetchActiveJob";
import { useFetchActivePipelineJsons } from "@/hooks/useFetchActivePipelineJsons";
import { PipelineJsonState, StepData, StepState } from "@/types";
import { combinePath } from "@/utils/file";
import { dirname } from "@/utils/path";
import { stepPathToProjectPath } from "@/utils/pipeline";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useFileManagerState } from "../hooks/useFileManagerState";

type PipelineUsage = {
  path: string;
  pipelineCwd: string;
  state: PipelineJsonState;
  step: StepData;
};

export type StepPipelines = {
  step: StepState;
};

export const StepPipelineSelector = () => {
  const step = useActiveStep();
  const { definitions, refresh } = useFetchActivePipelineJsons();
  const selectExclusive = useFileManagerState((state) => state.selectExclusive);
  const { pipelineUuid, jobUuid } = useCurrentQuery();
  const activeJob = useFetchActiveJob();
  const navigate = useNavigate();

  // Always reload pipeline definitions on render
  React.useEffect(refresh, [refresh]);

  const stepFilePath = React.useMemo(() => {
    if (!step) return undefined;

    const path = Object.entries(definitions).find(
      ([, { uuid }]) => uuid === pipelineUuid
    )?.[0];

    if (!path) return undefined;

    return stepPathToProjectPath(step.file_path, dirname(path));
  }, [definitions, step, pipelineUuid]);

  const usedIn = React.useMemo<PipelineUsage[]>(() => {
    if (!stepFilePath) return [];

    return Object.entries(definitions)
      .map(([path, state]) => {
        const pipelineCwd = dirname(path);
        const step = Object.values(state.steps).find(({ file_path }) => {
          const { root, path } = stepPathToProjectPath(file_path, pipelineCwd);

          return root === stepFilePath.root && path === stepFilePath.path;
        });

        return step ? { step, path, pipelineCwd, state } : undefined;
      })
      .filter(hasValue);
  }, [definitions, stepFilePath]);

  const changePipeline = (newPipelineUuid: string) => {
    const usage = usedIn.find((usage) => usage.state.uuid === newPipelineUuid);

    if (!usage) return;

    const combinedPath = combinePath({
      root: "/project-dir",
      path: usage.path,
    });

    selectExclusive(combinedPath);
    navigate({
      route: hasValue(jobUuid) ? "jobFilePreview" : "filePreview",
      query: { pipelineUuid: newPipelineUuid, stepUuid: usage.step.uuid },
    });
  };

  const pipelineLink = useRouteLink({
    route: hasValue(jobUuid) ? "jobRun" : "pipeline",
    query: { pipelineUuid },
    clear: ["stepUuid"],
  });

  if (usedIn.length === 0) return null;

  return (
    <Stack position="relative" direction="row" spacing={1} alignItems="center">
      {usedIn.length === 1 ? (
        <>
          <Typography variant="body2" color="text.secondary">
            Used in:
          </Typography>
          <Typography variant="body2" color="text.primary">
            {usedIn[0].path}
          </Typography>
        </>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary">
            Used in {usedIn.length} Pipelines:
          </Typography>
          <Select
            size="small"
            value={pipelineUuid}
            onChange={(event) => changePipeline(event.target.value)}
            sx={{
              padding: "0 !important",
              fontSize: "14px",
              fieldset: { border: "none" },
              ".MuiSelect-select": { padding: 0 },
            }}
          >
            {usedIn.map(({ path, state }) => (
              <MenuItem
                key={state.uuid}
                selected={pipelineUuid === state.uuid}
                value={state.uuid}
                disabled={hasValue(activeJob) && pipelineUuid !== state.uuid}
                dense
              >
                {path}
              </MenuItem>
            ))}
          </Select>
        </>
      )}

      <Button
        sx={{ marginLeft: 0 }}
        size="small"
        LinkComponent={RouteLink}
        href={pipelineLink}
      >
        Open
      </Button>
    </Stack>
  );
};
