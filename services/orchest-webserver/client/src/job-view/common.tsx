import { Json } from "@/types";

export const PARAMETERLESS_RUN = "Parameterless run";

export const formatPipelineParams = (parameters: Record<string, Json>) => {
  return Object.values(parameters).map((parameter) => {
    return Object.entries(parameter)
      .map(([key, value]) => {
        return `${key}: ${JSON.stringify(value)}`;
      })
      .join(", ");
  });
};
