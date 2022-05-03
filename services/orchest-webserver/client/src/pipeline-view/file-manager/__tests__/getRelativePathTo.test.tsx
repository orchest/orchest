import { findFirstDiffIndex, getRelativePathTo } from "../common";

describe("findFirstDiffIndex", () => {
  it("should return the index of the first diff char", () => {
    expect(findFirstDiffIndex("a/b/c.py".split("/"), "a/d".split("/"))).toBe(1);
  });
});

describe("getRelativePathTo", () => {
  it("should return the right relative path: case 1", () => {
    expect(getRelativePathTo("/a/b/c.py", "/")).toBe("a/b/c.py");
  });
  it("should return the right relative path: case 2", () => {
    expect(getRelativePathTo("/a/b/c.py", "/a/")).toBe("b/c.py");
  });
  it("should return the right relative path: case 3", () => {
    expect(getRelativePathTo("/a/b/c.py", "/a/d/")).toBe("../b/c.py");
  });
  it("should return the right relative path: case 4", () => {
    expect(getRelativePathTo("/a/b/c.py", "/a/b/d/e/f/")).toBe("../../../c.py");
  });
});
