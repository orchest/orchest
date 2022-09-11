import { choke } from "../promise";

const createLongPromise = () =>
  new Promise((resolve) => setTimeout(resolve, 10000));

describe("promise choking", () => {
  it("calls the first promise when parameters are identical and it is pending", () => {
    const fn = (a: number, b: number, c: number) => createLongPromise();

    const chokedFn = choke(fn);
    const firstPromise = chokedFn(1, 2, 3);
    const nextPromise = chokedFn(1, 2, 3);

    expect(nextPromise).toBe(firstPromise);
  });

  it("creates new promises when parameters are not equal", () => {
    const fn = (a: number, b: number, c: number) => createLongPromise();

    const chokedFn = choke(fn);
    const firstPromise = chokedFn(1, 2, 3);
    const nextPromise = chokedFn(3, 2, 1);

    expect(nextPromise).not.toBe(firstPromise);
  });
});
