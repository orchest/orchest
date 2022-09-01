import { deduplicates, replaces } from "../array";

describe("replacing array entries", () => {
  it("replaces the first entry that matches the predicate", () => {
    const replace = replaces((entry) => entry === "x", "ignore");

    expect(replace(["a", "x", "c", "x"], "r")).toEqual(["a", "r", "c", "x"]);
  });

  it("calls the predicate for each entry when none match", () => {
    const entries = ["a", "b", "c"];
    const predicate = jest.fn(() => false);
    const replace = replaces<string>(predicate, "ignore");

    replace(entries, "_");

    expect(predicate).toHaveBeenCalledTimes(entries.length);
  });

  it("does not modify the source array", () => {
    const entries = ["a", "b", "c"];
    const replace = replaces<string>((entry) => entry === "b", "ignore");

    expect(replace(entries, "r")).toEqual(["a", "r", "c"]);
    expect(entries).toEqual(["a", "b", "c"]);
  });
});

describe("replacement fallback strategies", () => {
  it("does nothing when set to 'ignore'", () => {
    const replace = replaces<string>((entry) => entry === null, "ignore");

    expect(replace(["a", "b", "c"], "r")).toEqual(["a", "b", "c"]);
  });

  it("uses 'ignore' by default", () => {
    const replace = replaces<string>((entry) => entry === null, "x" as any);

    expect(replace(["a", "b", "c"], "r")).toEqual(["a", "b", "c"]);
  });

  it("adds the item in the back when set to 'push'", () => {
    const replace = replaces<string>((entry) => entry === null, "push");

    expect(replace(["a", "b", "c"], "r")).toEqual(["a", "b", "c", "r"]);
  });

  it("adds the item in the front when set to 'unshift'", () => {
    const replace = replaces<string>((entry) => entry === null, "unshift");

    expect(replace(["a", "b", "c"], "r")).toEqual(["r", "a", "b", "c"]);
  });
});

describe("deduplicating arrays", () => {
  it("removes entries that share the same key", () => {
    const deduplicate = deduplicates<string>((s) => s);
    const input = ["a", "b", "c", "b", "c", "a", "b", "c"];
    const expected = ["a", "b", "c"];

    expect(deduplicate(input)).toEqual(expected);
  });

  it("merges multiple arrays", () => {
    const deduplicate = deduplicates<string>((s) => s);

    expect(deduplicate(["a", "b"], ["c", "d"])).toEqual(["a", "b", "c", "d"]);
  });
});
