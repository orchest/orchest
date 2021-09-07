import fetch from "isomorphic-unfetch";

export const fetcher = (input: RequestInfo, init: RequestInit) =>
  fetch(input, init).then((res) => {
    if (res.status >= 299) {
      throw res;
    }
    return res.json();
  });
