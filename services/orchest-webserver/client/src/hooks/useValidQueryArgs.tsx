import { hasValue } from "@orchest/lib-utils";
import { useCustomRoute } from "./useCustomRoute";

type QueryArgKey = keyof Omit<
  ReturnType<typeof useCustomRoute>,
  "navigateTo" | "location" | "prevPathname" | "isReadOnly" | "filePath" | "tab"
>;

type QueryArgs = Partial<Record<QueryArgKey, string | undefined>>;
type ValidQueryArgs = Partial<Record<QueryArgKey, string>>;

/**
 * Compares the given UUIDs with the query args from route and returns those that are equal and not undefined.
 * This is useful when there are hooks that depend on UUIDs like `projectUuid`, and these hooks
 * are expected to fire only when the given UUIDs and the UUIDs from the query args are are synced.
 */
export const useValidQueryArgs = (queryArgs: QueryArgs) => {
  const queryArgsFromRoute = useCustomRoute();

  return Object.entries(queryArgs).reduce((obj, [key, value]) => {
    const valueFromRoute = queryArgsFromRoute[key];
    const isValid = hasValue(value) && value === valueFromRoute;
    if (!isValid) return obj;
    return { ...obj, [key]: value };
  }, {} as ValidQueryArgs);
};
