import { memoized, PromiseCanceledError } from "../promise";

const createHungPromise = () => new Promise(() => {});
const delay = (duration: number) =>
  new Promise((resolve) => setTimeout(resolve, duration));

describe("pending promise memoization", () => {
  it("returns the memoized promise for pending promises with identical arguments", () => {
    const fn = (a: number) => createHungPromise();

    const memoizedFn = memoized(fn);
    const firstPromise = memoizedFn(1);
    const nextPromise = memoizedFn(1);

    expect(nextPromise).toBe(firstPromise);
  });

  it("creates new promises when parameters are not equal", () => {
    const fn = (a: number) => createHungPromise();

    const memoizedFn = memoized(fn);
    const firstPromise = memoizedFn(1);
    const nextPromise = memoizedFn(2);

    expect(nextPromise).not.toBe(firstPromise);
  });

  it("bypasses memoization when requested", () => {
    const fn = (a: number) => createHungPromise();

    const memoizedFn = memoized(fn);
    const firstPromise = memoizedFn(1);
    const bypassedPromise = memoizedFn.bypass(1);

    expect(bypassedPromise).not.toBe(firstPromise);
  });

  it("removes expired promises after their duration has elapsed", async () => {
    const fn = (a: number) => createHungPromise();

    const timeout = 2;
    const memoizedFn = memoized(fn, { timeout });
    const firstPromise = memoizedFn(1);

    await delay(timeout * 2);

    const nextPromise = memoizedFn(1);

    expect(nextPromise).not.toBe(firstPromise);
  });

  it("cancels expired promises after their duration has elapsed promises if configured", async () => {
    const fn = (a: number) => createHungPromise();

    const timeout = 2;
    const memoizedFn = memoized(fn, { timeout, cancelExpired: true });
    const promise = memoizedFn(1);

    await delay(timeout * 2);

    expect(promise).rejects.toThrowError(PromiseCanceledError);
  });
});
