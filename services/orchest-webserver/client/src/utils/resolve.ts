import { FetchError } from "@orchest/lib-utils";

export type Resolved<Value> =
  | { status: "fulfilled"; data: Value }
  | { status: "rejected"; error: FetchError };

/**
 * A try/catch wrapper of promise that returns an object literal with status
 * @param promise Promise
 * @param error FetchError
 * @returns Promise<{data: Value, status: 'fulfilled'} | { error: FetchError, status: 'rejected'}>
 */
export const resolve = async <Value>(
  promise: () => Promise<Value> | Value,
  error?: FetchError
): Promise<Resolved<Value>> => {
  try {
    const value = await promise();
    return { status: "fulfilled", data: value };
  } catch (upstreamError) {
    const currentError = error ||
      (upstreamError as FetchError) || {
        status: 500,
        message: "Error occurred",
      };
    if (process.env.NODE_ENV === "development") {
      console.error("upstreamError: ", upstreamError);
    }
    console.error(currentError);
    return { status: "rejected", error: currentError };
  }
};
