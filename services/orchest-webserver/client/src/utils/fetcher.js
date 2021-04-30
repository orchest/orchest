// @ts-check
import fetch from "isomorphic-unfetch";

export const fetcher = (input, init) =>
  fetch(input, init).then((res) => res.json());
