import { environmentsApi } from "@/api/environments/environmentsApi";
import { useFetchSnapshot } from "@/hooks/useFetchSnapshot";
import { useEditJob } from "@/jobs-view/stores/useEditJob";
import { ValidatedPipelineInSnapshot } from "@/types";
import React from "react";

export const useFetchSnapshotPipelines = () => {
  const snapshotUuid = useEditJob((state) => state.jobChanges?.snapshot_uuid);
  const { fetchSnapshot, snapshot } = useFetchSnapshot();

  React.useEffect(() => {
    if (snapshotUuid) fetchSnapshot(snapshotUuid);
  }, [fetchSnapshot, snapshotUuid]);

  const pipelines = React.useMemo(() => {
    return snapshot?.pipelines ? Object.values(snapshot.pipelines) : undefined;
  }, [snapshot?.pipelines]);

  const [validatedPipelines, setValidatedPipelines] = React.useState<
    ValidatedPipelineInSnapshot[]
  >();

  const validateEnvironments = React.useCallback(async () => {
    if (snapshot?.project_uuid && pipelines) {
      const result = await Promise.all(
        pipelines.map(
          async (pipeline): Promise<ValidatedPipelineInSnapshot> => {
            const environments = Object.values(pipeline.definition.steps).map(
              (step) => step.environment
            );
            if (environments.some((environment) => !environment))
              return { ...pipeline, valid: false };
            const uniqueEnvironments = new Set(environments);
            const valid = await environmentsApi.haveAllEnvironmentsBuilt(
              snapshot.project_uuid,
              [...uniqueEnvironments]
            );
            return { ...pipeline, valid };
          }
        )
      );
      setValidatedPipelines(result);
    }
  }, [pipelines, snapshot?.project_uuid]);

  React.useEffect(() => {
    validateEnvironments();
  }, [validateEnvironments]);

  return { pipelines: validatedPipelines };
};
