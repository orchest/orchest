import { filesApi } from "@/api/files/fileApi";
import { FileMap } from "./file-map";
import { basename, dirname, hasExtension, join } from "./path";

export type FileMetadata = { isDirectory: boolean; fetchedAt: number };

export const fileRoots = ["/project-dir", "/data"] as const;

export type FileRoot = typeof fileRoots[number];

export type RootMap = Record<FileRoot, FileMap>;

export const ROOT_SEPARATOR = ":";

export type UnpackedPath = {
  /** Either `/project-dir` or `/data` */
  root: FileRoot;
  /** The path to the file, always starts with "/" */
  path: string;
};

/** Returns true if the path has the `.orchest` extension. */
export const isPipelineFile = (path: string) => hasExtension(path, "orchest");

/** Returns true if the combined path is in the `/data:` file root. */
export const isInDataFolder = (combinedPath: string) =>
  /^\/data\:?\//.test(combinedPath);

/** Returns true if the combined path is in the `/project-dir:` file root. */
export const isInProjectFolder = (combinedPath: string) =>
  /^\/project-dir\:?\//.test(combinedPath);

/**
 * Unpacks an combined path into `root` and `path`.
 * For example `/project-dir:/a/b` will unpack into `/project-dir:` and `/a/b/`.
 *
 * Note: If the path provided is not a combined path, this function may return
 * something nonsensical. You can use `isCombinedPath` to check.
 */
export const unpackPath = (combinedPath: string): UnpackedPath => {
  const root = combinedPath.split(":")[0] as FileRoot;
  const path = combinedPath.slice(root.length + ROOT_SEPARATOR.length);

  return { root, path };
};

export const isCombinedPath = (path: string) => /^\/([a-z]|\-)+:\//.test(path);

export const combinePath = ({ root, path }: UnpackedPath) =>
  join(root + ROOT_SEPARATOR, path);

/**
 * A tuple that describes a move.
 * The first value is the old path,
 * the second is the new path.
 */
export type Move = readonly [string, string];

export type UnpackedMove = {
  oldRoot: FileRoot;
  oldPath: string;
  newRoot: FileRoot;
  newPath: string;
};

export const isRename = (moves: readonly Move[]) =>
  moves.length === 1 && dirname(moves[0][0]) === dirname(moves[0][1]);

export const unpackMove = ([source, target]: Move): UnpackedMove => {
  const { root: oldRoot, path: oldPath } = unpackPath(source);
  const { root: newRoot, path: newPath } = unpackPath(target);

  return { oldRoot, oldPath, newRoot, newPath };
};

export type FileDownload = {
  projectUuid: string;
  root: FileRoot;
  path: string;
  name?: string;
};

export const downloadFile = ({
  projectUuid,
  root,
  path,
  name = basename(path),
}: FileDownload) => {
  const downloadUrl = filesApi.getDownloadUrl(projectUuid, root, path);

  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
};
