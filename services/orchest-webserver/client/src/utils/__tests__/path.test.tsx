import * as path from "../path";

describe("join", () => {
  it("removes empty segments", () => {
    expect(path.join("/foo//", "bar", "////", "baz")).toBe("/foo/bar/baz");
  });

  it("collapses `..`", () => {
    expect(path.join("/foo/bar/bat", "..", "baz")).toBe("/foo/bar/baz");
  });

  it("removes `.`", () => {
    expect(path.join("/foo/./bar", ".", "/./baz")).toBe("/foo/bar/baz");
  });

  it("preserves trailing slashes", () => {
    expect(path.join("/foo", "bar/baz/")).toBe("/foo/bar/baz/");
  });
});

describe("dirname", () => {
  it("returns the containing directory of files", () => {
    expect(path.dirname("/foo/bar/baz.bat")).toBe("/foo/bar/");
  });

  it("returns the containing directory for directories", () => {
    expect(path.dirname("/foo/bar/baz.bat/")).toBe("/foo/bar/");
  });

  it("does not normalize paths", () => {
    expect(path.dirname("/../.foo/./../bar/baz")).toBe("/../.foo/./../bar/");
  });

  it("returns a when the input is empty", () => {
    expect(path.dirname("")).toBe(".");
  });
});

describe("basename", () => {
  it("returns the name of files", () => {
    expect(path.basename("/foo/bar/baz.bat")).toBe("baz.bat");
  });

  it("returns the name of directories", () => {
    expect(path.basename("/foo/bar/baz.bat/")).toBe("baz.bat");
  });

  it("returns an empty string for an empty input", () => {
    expect(path.basename("")).toBe("");
  });
});

describe("extname", () => {
  it("returns the last extension of a file name", () => {
    expect(path.extname("/foo/bar.baz.bat")).toBe(".bat");
  });

  it("returns an empty string for dotfiles", () => {
    expect(path.extname(".foo")).toBe("");
  });

  it("returns the last extension of a dotfile with extensions", () => {
    expect(path.extname(".foo.bar.baz")).toBe(".baz");
  });

  it("returns an empty string for an empty input", () => {
    expect(path.extname("")).toBe("");
  });
});

describe("relative", () => {
  it("resolves the expected paths", () => {
    expect(path.relative("/", "/")).toBe("");
    expect(path.relative("/", "/a/b/c.py")).toBe("a/b/c.py");
    expect(path.relative("/a/", "/a/b/c.py")).toBe("b/c.py");
    expect(path.relative("/a/d/", "/a/b/c.py")).toBe("../b/c.py");
    expect(path.relative("/a/b/d/e/f/", "/a/b/c.py")).toBe("../../../c.py");
  });

  it("returns an empty string for two empty inputs", () => {
    expect(path.relative("", "")).toBe("");
  });
});

describe("hasExtension", () => {
  it("returns false when the extension does not match", () => {
    expect(path.hasExtension("/foo/bar/baz.bat", "nope")).toBe(false);
  });

  it("compares extensions ignoring case", () => {
    expect(path.hasExtension("/foo/bar/baz.bat", "BAT")).toBe(true);
  });

  it("returns true if any extension matches", () => {
    expect(path.hasExtension("/foo/bar/baz.bat", "nope", "bat")).toBe(true);
  });

  it("supports providing extensions with a leading dot", () => {
    expect(path.hasExtension("/foo/bar/baz.bat", ".bat")).toBe(true);
  });
});

describe("hasAncestor", () => {
  it("returns false if the ancestor path is not a directory", () => {
    expect(path.hasAncestor("/foo/bar/baz.bat", "/foo/bar")).toBe(false);
  });

  it("returns true if the ancestor is the parent", () => {
    expect(path.hasAncestor("/foo/bar/baz.bat", "/foo/bar/")).toBe(true);
  });

  it("returns true if the ancestor is the parents parent", () => {
    expect(path.hasAncestor("/foo/bar/baz.bat", "/foo/")).toBe(true);
  });

  it("compares normalized paths", () => {
    expect(path.hasAncestor("/./foo/bar/baz.bat", "/foo/../foo/")).toBe(true);
  });
});
