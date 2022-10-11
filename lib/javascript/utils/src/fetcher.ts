/* eslint-disable @typescript-eslint/no-explicit-any */
export class FetchError extends Error {
  readonly name = "FetchError";
  /** The HTTP status code of the response. */
  readonly status?: number;
  /** Commonly the serialized JSON body, or the body text if not JSON. */
  readonly body?: any;

  constructor(message: string, status?: number, body?: any) {
    super(message);
    this.status = status;
    this.body = body;
  }

  static async fromResponse(response: Response): Promise<FetchError> {
    if (isJsonResponse(response)) {
      const body = await getJsonPayload(response);
      const message =
        typeof body.message === "string"
          ? `${formatStatus(response)} / ${body.message}`
          : formatStatus(response);

      return new FetchError(message, response.status, body);
    } else {
      const body = await response.text();

      return new FetchError(formatStatus(response), response.status, body);
    }
  }
}

const formatStatus = (response: Response) =>
  response.statusText
    ? `${response.status} (${response.statusText})`
    : response.status.toString();

const isJsonResponse = (response: Response) =>
  Boolean(response.headers.get("content-type")?.startsWith("application/json"));

const getJsonPayload = async <T = any>(response: Response): Promise<T> => {
  const body = await response.text();

  return body === "" ? {} : JSON.parse(body);
};

const getFullUrl = (url: string) => `${__BASE_URL__}${url}`;

export const fetcher = async <T>(
  url: string,
  params?: RequestInit
): Promise<T> => {
  const targetUrl = getFullUrl(url);
  const response = await window.fetch(targetUrl, params);

  if (!response.ok || response.status >= 299) {
    const error = await FetchError.fromResponse(response);

    return Promise.reject(error);
  } else {
    return await getJsonPayload<T>(response);
  }
};

export type Fetcher<T = void> = (
  url: string,
  params?: RequestInit | undefined
) => Promise<T>;

export type ContentType =
  | "application/json"
  | "application/x-www-form-urlencoded";

export const HEADER = {
  JSON: { "Content-Type": "application/json; charset=UTF-8" },
  FORM: {
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
  },
};
