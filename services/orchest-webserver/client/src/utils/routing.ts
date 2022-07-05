import { hasValue } from "@orchest/lib-utils";

const snakeCase = (str: string, divider = "_") =>
  str
    .split(/(?=[A-Z])/)
    .join(divider)
    .toLowerCase();

export const toQueryString = <T extends string>(
  query:
    | Partial<Record<T, string | number | boolean | undefined | null>>
    | null
    | undefined
) => {
  const isObject =
    typeof query === "object" &&
    query !== null &&
    typeof query !== "function" &&
    !Array.isArray(query);
  return isObject
    ? Object.entries<string | number | boolean | undefined | null>(query)
        .reduce((str, entry) => {
          const [key, value] = entry;
          const encodedValue = hasValue(value) // we don't pass along null or undefined since it doesn't mean much to the receiver
            ? encodeURIComponent(value.toString())
            : null;
          return encodedValue
            ? `${str}${snakeCase(key)}=${encodedValue}&`
            : str;
        }, "?")
        .slice(0, -1) // remove the trailing '&' or '?'.
    : "";
};
