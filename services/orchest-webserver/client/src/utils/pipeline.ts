import { filesApi } from "@/api/files/fileApi";
import type {
  PipelineMetaData,
  PipelineRunStatus,
  StepsDict,
  StepState,
} from "@/types";
import { hasValue } from "@orchest/lib-utils";
import { isPipelineFile, UnpackedPath } from "./file";
import { addLeadingSlash, isDirectory, join, relative } from "./path";

export const PIPELINE_RUNNING_STATES: readonly PipelineRunStatus[] = [
  "PENDING",
  "STARTED",
];

export const PIPELINE_IDLING_STATES: readonly PipelineRunStatus[] = [
  "SUCCESS",
  "ABORTED",
  "FAILURE",
];

export const isPipelineRunning = (runStatus?: PipelineRunStatus) =>
  hasValue(runStatus) && PIPELINE_RUNNING_STATES.includes(runStatus);

export const isPipelineIdling = (runStatus?: PipelineRunStatus) =>
  hasValue(runStatus) && PIPELINE_IDLING_STATES.includes(runStatus);

/** Combines the pipeline & project UUID of the pipeline. */
export const uniquePipelineId = (pipeline: PipelineMetaData) =>
  `${pipeline.project_uuid}:${pipeline.uuid}`;

export const projectPathToStepPath = (
  { root, path }: UnpackedPath,
  pipelineCwd: string
): string =>
  root === "/data" ? join(root, path) : relative(pipelineCwd, path);

export const stepPathToProjectPath = (
  path: string,
  pipelineCwd: string
): UnpackedPath =>
  path.startsWith("/data/")
    ? { root: "/data", path: path.substring("/data".length) }
    : { root: "/project-dir", path: join(addLeadingSlash(pipelineCwd), path) };

export const findPipelineFiles = async (
  projectUuid: string,
  filePaths: UnpackedPath[]
): Promise<UnpackedPath[]> => {
  const paths = await Promise.all(
    filePaths.map(({ root, path }) => {
      if (isDirectory(path)) {
        return filesApi
          .extensionSearch({
            projectUuid,
            extensions: ["orchest"],
            root,
            path,
          })
          .then((files) =>
            files.map((file) => ({
              root,
              path: `/${file}`,
            }))
          );
      } else {
        return isPipelineFile(path) ? { root, path } : null;
      }
    })
  );

  return paths
    .filter((value) => hasValue(value))
    .flatMap((value) => value as UnpackedPath);
};
/** Sorts the steps of the pipeline in topological order. */
export const sortPipelineSteps = (steps: StepsDict) => {
  const sortedStepKeys: string[] = [];

  const conditionalAdd = (step: StepState) => {
    // add if all parents are already in the sortedStepKeys
    let parentsAdded = true;

    for (const connection of step.incoming_connections) {
      if (!sortedStepKeys.includes(connection)) {
        parentsAdded = false;
        break;
      }
    }

    if (!sortedStepKeys.includes(step.uuid) && parentsAdded) {
      sortedStepKeys.push(step.uuid);
    }
  };

  // Add self and children (breadth first)
  let addSelfAndChildren = (step: StepState) => {
    conditionalAdd(step);

    const outgoingConnections = (step as StepState).outgoing_connections || [];

    for (const childStepUuid of outgoingConnections) {
      let childStep = steps[childStepUuid];

      conditionalAdd(childStep);
    }

    // Recurse down
    for (const childStepUUID of outgoingConnections) {
      addSelfAndChildren(steps[childStepUUID]);
    }
  };

  // Find roots
  for (const step of Object.values(steps)) {
    if (step.incoming_connections.length == 0) {
      addSelfAndChildren(step);
    }
  }

  return sortedStepKeys.map((stepUUID) => steps[stepUUID]);
};
