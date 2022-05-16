export * from "./fetcher";
export * from "./typed";
export * from "./typedIncludes";
export * from "./untyped";

declare global {
  const __BASE_URL__: string;
}
