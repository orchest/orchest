import { hasValue } from "@orchest/lib-utils";

export const commaSeparatedString = (arr: string[]) => {
  const listStart = arr.slice(0, -1).join(", ");
  const listEnd = arr.slice(-1);
  const conjunction = arr.length <= 1 ? "" : " and ";

  return [listStart, listEnd].join(conjunction);
};

export const capitalize = (str: string) =>
  str.charAt(0).toUpperCase() + str.slice(1);

const camelToSnakeCase = (str: string) =>
  str
    .replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
    .replace(/^_+(.*?)_+$/g, (_, group1) => group1); // Remove leading and trailing underscores.

export type QueryArgsProps = Record<
  string,
  string | number | boolean | undefined | null
>;

export const queryArgs = (obj: QueryArgsProps) => {
  return Object.entries(obj).reduce((str, [key, value]) => {
    if (!hasValue(value)) return str;
    const leadingCharts = str === "" ? str : `${str}&`;
    const snakeCaseKey = camelToSnakeCase(key);
    return `${leadingCharts}${snakeCaseKey}=${window.encodeURIComponent(
      value
    )}`;
  }, "");
};
