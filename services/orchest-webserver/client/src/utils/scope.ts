import { ScopeParameter, ScopeParameters } from "@/types";
import { hasValue } from "@orchest/lib-utils";

export const ALL_SCOPE_PARAMETERS: readonly ScopeParameter[] = [
  "projectUuid",
  "pipelineUuid",
  "jobUuid",
  "runUuid",
  "environmentUuid",
  "stepUuid",
  "filePath",
  "fileRoot",
  "tab",
];

export const getMissingParameters = <S extends ScopeParameter>(
  parameters: Partial<ScopeParameters>,
  desired: readonly S[]
): S[] => desired.filter((name) => !hasValue(parameters[name]));

export function assertInScope<S extends ScopeParameter>(
  parameters: Partial<Pick<ScopeParameters, S>>,
  required: readonly S[]
): asserts parameters is Pick<ScopeParameters, S> {
  const missing = getMissingParameters(parameters, required);

  if (missing.length === 0) return;

  throw new Error(
    `The following scope parameters are missing: ${missing.join(", ")}. ` +
      "Was the URL tampered with?"
  );
}
