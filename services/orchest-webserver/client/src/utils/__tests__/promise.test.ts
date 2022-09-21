import { memoize, PromiseCanceledError } from "../promise";

const createHungPromise = () => new Promise(() => {});
const delay = (duration: number) =>
  new Promise((resolve) => setTimeout(resolve, duration));

describe("pending promise memoization", () => {
  it("returns the memoized promise for pending promises with identical arguments", () => {
    const fn = (a: number) => createHungPromise();

    const memoizedFn = memoize(fn);
    const firstPromise = memoizedFn(1);
    const nextPromise = memoizedFn(1);

    expect(nextPromise).toBe(firstPromise);
  });

  it("creates new promises when parameters are not equal", () => {
    const fn = (a: number) => createHungPromise();

    const memoizedFn = memoize(fn);
    const firstPromise = memoizedFn(1);
    const nextPromise = memoizedFn(2);

    expect(nextPromise).not.toBe(firstPromise);
  });

  it("bypasses memoization when requested", () => {
    const fn = (a: number) => createHungPromise();

    const memoizedFn = memoize(fn);
    const firstPromise = memoizedFn(1);
    const bypassedPromise = memoizedFn.bypass(1);

    expect(bypassedPromise).not.toBe(firstPromise);
  });

  it("removes expired promises after their duration has elapsed", async () => {
    const fn = (a: number) => createHungPromise();

    const duration = 2;
    const memoizedFn = memoize(fn, { duration });
    const firstPromise = memoizedFn(1);

    await delay(duration * 2);

    const nextPromise = memoizedFn(1);

    expect(nextPromise).not.toBe(firstPromise);
  });

  it("cancels expired promises after their duration has elapsed promises if configured", async () => {
    const fn = (a: number) => createHungPromise();

    const duration = 2;
    const memoizedFn = memoize(fn, { duration, cancelExpired: true });
    const promise = memoizedFn(1);

    await delay(duration * 2);

    expect(promise).rejects.toThrowError(PromiseCanceledError);
  });
});
