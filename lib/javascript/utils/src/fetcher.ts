export type FetchError = {
  status?: number;
  message: string;
  body?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

const getExactUrl = (url: string) => `${__BASE_URL__}${url}`;

export const fetcher = async <T, E = FetchError>(
  url: string,
  params?: RequestInit
) => {
  const targetUrl = getExactUrl(url);

  const response = await window.fetch(targetUrl, params);
  const responseAsString = await response.text();
  const jsonResponse =
    responseAsString === "" ? {} : JSON.parse(responseAsString);

  if (!response.ok || response.status >= 299) {
    const { message, ...rest } = jsonResponse;
    return Promise.reject({
      status: response.status,
      message: message || response.statusText,
      ...rest, // pass along the payload of the error
    } as E);
  }

  return jsonResponse as Promise<T>;
};

export type Fetcher<T = void> = (
  url: string,
  params?: RequestInit | undefined
) => Promise<T>;

export const HEADER = {
  JSON: { "Content-Type": "application/json; charset=UTF-8" },
  FORM: {
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
  },
};
