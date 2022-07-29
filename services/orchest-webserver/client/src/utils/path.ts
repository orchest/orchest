/*
 * This module exports our hand-rolled path functions.
 * All functions that share names with the NodeJS internals
 * also share their behavior unless otherwise noted.
 *
 * We also never perform any type checking within these functions
 * since we're using TypeScript for that: passing an illegal type to these
 * functions is for all intents & purposes "undefined behavior".
 *
 * Some algorithms are from https://github.com/jinder/path
 * with slight tweaks and  modification.
 */

/** Returns true if the path starts with `/`. */
export const isAbsolute = (path: string) => path.startsWith("/");

/** Returns true if the path ends with `/`. */
export const isDirectory = (path: string) => path.endsWith("/");

/** Returns the last segment of the path. */
export const basename = (path: string) => segments(path).pop() ?? "";

/**
 * Returns the path up until the last segment.
 * **Note:** The returned path ends with `/`.
 */
export const dirname = (path: string) => {
  if (!path) return ".";

  return isDirectory(path)
    ? path.split("/").slice(0, -2).join("/") + "/"
    : path.split("/").slice(0, -1).join("/") + "/";
};

/**
 * Returns the extension of the path if there is one (e.g. `.py`).
 * **Tip:** To compare extensions, use `hasExtension` instead.
 */
export const extname = (path: string) => {
  const parts = basename(path).split(".").filter(Boolean);

  return parts.length > 1 ? "." + parts.pop() : "";
};

/**
 * Returns true if the path ends with one of the provided extensions.
 * The comparison ignores casing.
 * @param extensions The extensions to test, e.g. `.py` or `py`.
 */
export const hasExtension = (path: string, ...extensions: string[]) =>
  RegExp(
    `\.(${extensions
      .map((extension) => extension.replace(/^\./, ""))
      .join("|")})$`,
    "i"
  ).test(path);

/** Returns true if the `ancestorPath` is a directory that includes `path`. */
export const hasAncestor = (path: string, ancestorPath: string) =>
  isDirectory(ancestorPath) &&
  normalize(path).startsWith(normalize(ancestorPath));

/** Removes empty segments and resolves `..` and `.` in the path. */
export const normalize = (path: string) => {
  if (!path) return ".";

  const isAbsolutePath = isAbsolute(path);
  let normalized = normalizeSegments(segments(path), !isAbsolutePath).join("/");

  if (isAbsolutePath) normalized = "/" + normalized;
  if (isDirectory(path)) normalized = normalized + "/";

  return normalized;
};

/** Joins and normalizes the provided parts. */
export const join = (...parts: readonly string[]) => normalize(parts.join("/"));

/** Calculates the relative path of two paths. */
export const relative = (from: string, to: string) => {
  const fromSegments = normalizeSegments(segments(from));
  const toSegments = normalizeSegments(segments(to));

  const length = Math.min(fromSegments.length, toSegments.length);
  let samePartsLength = length;

  for (let i = 0; i < length; i++) {
    if (fromSegments[i] !== toSegments[i]) {
      samePartsLength = i;
      break;
    }
  }

  const result: string[] = [];

  for (let i = samePartsLength; i < fromSegments.length; i++) {
    result.push("..");
  }

  return result.concat(toSegments.slice(samePartsLength)).join("/");
};

/** Returns the segments of the paths, ignoring empty segments. */
export const segments = (path: string) => path.split("/").filter(Boolean);

/** Resolves `..` and `.`, and removes empty segments. */
export const normalizeSegments = (
  segments: readonly string[],
  allowAboveRoot = false
) => {
  const result: string[] = [];

  for (const segment of segments) {
    if (!segment || segment === ".") continue;

    if (segment === "..") {
      if (result.length && result[result.length - 1] !== "..") {
        result.pop();
      } else if (allowAboveRoot) {
        result.push("..");
      }
    } else {
      result.push(segment);
    }
  }

  return result;
};
