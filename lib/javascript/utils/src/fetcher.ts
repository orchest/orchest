export type FetchError = {
  status?: number;
  message: string;
  body?: any;
};

export const fetcher = async <T>(url: RequestInfo, params?: RequestInit) => {
  const response = await window.fetch(url, params);
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
};
