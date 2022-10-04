import { ScopeParameter, ScopeParameters } from "@/types";
import { pick } from "@/utils/record";
import React from "react";
import { useCustomRoute } from "./useCustomRoute";

const allParameters: readonly ScopeParameter[] = [
  "projectUuid",
  "pipelineUuid",
  "jobUuid",
  "runUuid",
  "environmentUuid",
  "stepUuid",
];

export const useScopeParameters = <S extends ScopeParameter>(
  requested: readonly S[] = allParameters as S[]
): Partial<Pick<ScopeParameters, S>> => {
  const route = useCustomRoute();

  return React.useMemo(() => pick(route, ...requested), [route, requested]);
};
