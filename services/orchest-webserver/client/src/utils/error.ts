export type ErrorDetails = {
  name: string;
  message?: string | undefined;
  stack?: string | undefined;
};

/**
 * Given an error-like object, attempts to extracts as much error details as possible.
 * @param error An error-like object to extract information from.
 */
export const extractErrorDetails = (error: unknown): ErrorDetails => {
  if (!error) {
    return { name: "Unknown error" };
  } else if (error instanceof Error) {
    return error;
  } else if (typeof error === "string") {
    return { name: "Message", message: error };
  } else if (typeof error === "object") {
    return {
      name: error["name"] ?? "Error",
      message: error["message"] ?? undefined,
      stack: error["stack"] ?? undefined,
    };
  } else {
    return { name: "Error", message: String(error) };
  }
};
