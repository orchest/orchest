import { useReadFile } from "@/hooks/useReadFile";
import { JsonSchema, UISchemaElement } from "@jsonforms/core";

type UseReadPipelineSchemaFilesParams = {
  projectUuid: string | undefined;
  pipelineUuid: string | undefined;
  jobUuid?: string | undefined;
  runUuid?: string | undefined;
  pipelinePath: string | undefined;
};

export const useReadPipelineSchemaFiles = ({
  projectUuid,
  pipelineUuid,
  jobUuid,
  runUuid,
  pipelinePath,
}: UseReadPipelineSchemaFilesParams) => {
  const [parameterSchema] = useReadFile<JsonSchema>({
    projectUuid,
    pipelineUuid,
    jobUuid,
    runUuid,
    path: pipelinePath ? pipelinePath.concat(".schema.json") : undefined,
    allowedExtensions: ["json"],
  });

  const [parameterUiSchema] = useReadFile<UISchemaElement>({
    projectUuid,
    pipelineUuid,
    jobUuid,
    runUuid,
    path: pipelinePath ? pipelinePath.concat(".uischema.json") : undefined,
    allowedExtensions: ["json"],
  });

  return { parameterSchema, parameterUiSchema };
};
