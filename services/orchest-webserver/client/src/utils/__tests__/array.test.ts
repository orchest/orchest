import { deduplicates, replaces } from "../array";

describe("replacing array items", () => {
  it("replaces the first item that matches the predicate", () => {
    const replace = replaces((item) => item === "x", "ignore");

    expect(replace(["a", "x", "c", "x"], "r")).toEqual(["a", "r", "c", "x"]);
  });

  it("calls the predicate for each item when none match", () => {
    const items = ["a", "b", "c"];
    const predicate = jest.fn(() => false);
    const replace = replaces<string>(predicate, "ignore");

    replace(items, "_");

    items.forEach((item, i) =>
      expect(predicate).toHaveBeenNthCalledWith(i + 1, item, i, items)
    );
    expect(predicate).toHaveBeenCalledTimes(items.length);
  });

  it("does not modify the source array", () => {
    const source = ["a", "b", "c"];
    const replace = replaces<string>((item) => item === "b", "ignore");

    expect(replace(source, "r")).toEqual(["a", "r", "c"]);
    expect(source).toEqual(["a", "b", "c"]);
  });
});

describe("replacement fallback strategies", () => {
  it("does nothing when set to 'ignore'", () => {
    const replace = replaces<string>((item) => item === null, "ignore");

    expect(replace(["a", "b", "c"], "r")).toEqual(["a", "b", "c"]);
  });

  it("uses 'ignore' by default", () => {
    const replace = replaces<string>((item) => item === null, "x" as any);

    expect(replace(["a", "b", "c"], "r")).toEqual(["a", "b", "c"]);
  });

  it("adds the item in the back when set to 'push'", () => {
    const replace = replaces<string>((item) => item === null, "push");

    expect(replace(["a", "b", "c"], "r")).toEqual(["a", "b", "c", "r"]);
  });

  it("adds the item in the front when set to 'unshift'", () => {
    const replace = replaces<string>((item) => item === null, "unshift");

    expect(replace(["a", "b", "c"], "r")).toEqual(["r", "a", "b", "c"]);
  });
});

describe("deduplicating arrays", () => {
  it("it merges arrays and omits items that share the same key", () => {
    const deduplicate = deduplicates<string>((key) => key);
    const input = [
      ["a", "b", "c", "b"],
      ["c", "a", "b", "c"],
    ];
    const expected = ["a", "b", "c"];

    expect(deduplicate(...input)).toEqual(expected);
  });
});
