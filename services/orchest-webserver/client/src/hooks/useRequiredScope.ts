import { ScopeParameter, ScopeParameters } from "@/types";
import { pick } from "@/utils/record";
import { hasValue } from "@orchest/lib-utils";
import { useCustomRoute } from "./useCustomRoute";

/**
 * Returns the requested scope parameters if they are all currently present in the URL.
 * An error is thrown if some requested parameter is missing.
 */
export const useRequiredScope = <S extends ScopeParameter>(
  requested: readonly S[]
) => {
  const route = useCustomRoute();
  const parameters = pick(route, ...requested);

  assertHasScope<S>(parameters);

  return parameters;
};

const getMissingParameters = <S extends ScopeParameter>(
  parameters: Partial<Pick<ScopeParameters, S>>
) => {
  return Object.entries(parameters)
    .filter(([, value]) => !hasValue(value))
    .map(([name]) => name);
};

function assertHasScope<S extends ScopeParameter>(
  parameters: Partial<Pick<ScopeParameters, S>>
): asserts parameters is Pick<ScopeParameters, S> {
  const missingParameters = getMissingParameters(parameters);

  if (missingParameters.length === 0) return;

  throw new Error(
    `Missing required scope parameter(s): ${missingParameters.join(", ")}.`
  );
}
