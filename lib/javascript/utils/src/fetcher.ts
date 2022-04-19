export type FetchError = {
  status?: number;
  message: string;
  body?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

const getTargetUrl = (url: string) => __BASE_URL__ + url;

export const fetcher = async <T>(url: string, params?: RequestInit) => {
  const targetUrl = getTargetUrl(url);

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
    } as FetchError);
  }

  return jsonResponse as Promise<T>;
};

export const HEADER = {
  JSON: { "Content-Type": "application/json; charset=UTF-8" },
  FORM: {
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
  },
};
