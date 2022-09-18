import { environmentsApi } from "@/api/environments/environmentsApi";
import { useFetchSnapshot } from "@/hooks/useFetchSnapshot";
import { useValidJobQueryArgs } from "@/jobs-view/hooks/useValidJobQueryArgs";
import { useEditJob } from "@/jobs-view/stores/useEditJob";
import { ValidatedPipelineInSnapshot } from "@/types";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

export const useFetchSnapshotPipelines = () => {
  const { projectUuid, jobUuid } = useValidJobQueryArgs();
  const snapshotUuid = useEditJob((state) =>
    hasValue(projectUuid) && hasValue(jobUuid)
      ? state.jobChanges?.snapshot_uuid
      : undefined
  );
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

  const snapshotProjectUuid = React.useMemo(
    () =>
      hasValue(projectUuid) && projectUuid === snapshot?.project_uuid
        ? projectUuid
        : undefined,
    [projectUuid, snapshot?.project_uuid]
  );

  const validateEnvironments = React.useCallback(async () => {
    if (snapshotProjectUuid && pipelines) {
      const result = await Promise.all(
        pipelines.map(
          async (pipeline): Promise<ValidatedPipelineInSnapshot> => {
            const environmentsInSteps = Object.values(
              pipeline.definition.steps
            ).map((step) => step.environment);

            if (environmentsInSteps.some((environment) => !environment))
              return { ...pipeline, valid: false };

            const environmentsInServices = pipeline.definition.services
              ? (Object.values(pipeline.definition.services)
                  .map((service) =>
                    service.image.startsWith("environment@")
                      ? service.image.replace("environment@", "")
                      : undefined
                  )
                  .filter(Boolean) as string[])
              : [];

            const environments = [
              ...environmentsInSteps,
              ...environmentsInServices,
            ];

            const uniqueEnvironments = new Set(environments);
            const valid = await environmentsApi.haveAllEnvironmentsBuilt(
              snapshotProjectUuid,
              [...uniqueEnvironments]
            );
            return { ...pipeline, valid };
          }
        )
      );
      setValidatedPipelines(result);
    }
  }, [pipelines, snapshotProjectUuid]);

  React.useEffect(() => {
    validateEnvironments();
  }, [validateEnvironments]);

  return { pipelines: validatedPipelines };
};
