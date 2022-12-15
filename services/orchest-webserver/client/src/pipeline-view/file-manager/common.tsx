import { Code } from "@/components/common/Code";
import { StepData } from "@/types";
import {
  FileRoot,
  fileRoots,
  isInDataFolder,
  Move,
  unpackPath,
} from "@/utils/file";
import {
  basename,
  dirname,
  hasAncestor,
  hasExtension,
  isDirectory,
  relative,
} from "@/utils/path";
import { ALLOWED_STEP_EXTENSIONS, hasValue } from "@orchest/lib-utils";
import React from "react";

export const FILE_MANAGEMENT_ENDPOINT = "/async/file-management";
export const FILE_MANAGER_ROOT_CLASS = "file-manager-root";

export const getMoveFromDrop = (sourcePath: string, dropPath: string): Move => {
  if (sourcePath === dropPath || dropPath.startsWith(sourcePath)) {
    return [sourcePath, sourcePath];
  }

  const isSourceDir = isDirectory(sourcePath);
  const isTargetDir = isDirectory(dropPath);

  const sourceBasename = basename(sourcePath);
  const dropFolderPath = isTargetDir ? dropPath : dirname(dropPath);

  const newPath = dropFolderPath + sourceBasename + (isSourceDir ? "/" : "");

  return [sourcePath, newPath];
};

export const getActiveRoot = (selected: string[]): FileRoot => {
  if (selected.length === 0) {
    return fileRoots[0];
  } else {
    return unpackPath(selected[0]).root;
  }
};

export const cleanFilePath = (filePath: string, replaceProjectDirWith = "") =>
  filePath
    .replace(/^\/project-dir\:\//, replaceProjectDirWith)
    .replace(/^\/data\:\//, "/data/");

/** Prettifies the root name for display purposes. */
export const prettifyRoot = (root: string) => {
  switch (root) {
    case "project-dir:":
    case "/project-dir":
      return "Project files";
    case "data:":
      return "/data";
    default:
      return root;
  }
};

/** Remove leading "./" of a file path */
export const removeLeadingSymbols = (filePath: string) =>
  filePath.replace(/^\.\//, "");

// user might enter "./foo.ipynb", but it's equivalent to "foo.ipynb".
// this function cleans up the leading "./"
export const getStepFilePath = (step: StepData) =>
  removeLeadingSymbols(step.file_path);

/**
 * Notebook files cannot be reused in the same pipeline, this function separate Notebook files that are already in use
 * from all the other allowed files
 */
export const validateFiles = (
  currentStepUuid: string | undefined,
  steps: Record<string, StepData> | undefined,
  selectedFiles: string[]
) => {
  const allNotebookFileSteps = Object.values(steps || {}).reduce(
    (all, step) => {
      const filePath = getStepFilePath(step);
      if (hasExtension(filePath, "ipynb")) {
        return [...all, { ...step, file_path: filePath }];
      }
      return all;
    },
    [] as StepData[]
  );

  return selectedFiles.reduce(
    (all, curr) => {
      const usedNotebookFiles = allNotebookFileSteps.find((step) => {
        return (
          step.file_path === cleanFilePath(curr) &&
          currentStepUuid !== step.uuid // assigning the same file to the same step is allowed
        );
      });

      return usedNotebookFiles
        ? {
            ...all,
            usedNotebookFiles: [...all.usedNotebookFiles, cleanFilePath(curr)],
          }
        : !hasExtension(curr, ...ALLOWED_STEP_EXTENSIONS)
        ? { ...all, forbidden: [...all.forbidden, cleanFilePath(curr)] }
        : { ...all, allowed: [...all.allowed, cleanFilePath(curr)] };
    },
    {
      usedNotebookFiles: [] as string[],
      forbidden: [] as string[],
      allowed: [] as string[],
    }
  );
};

export const allowedExtensionsMarkup = ALLOWED_STEP_EXTENSIONS.map(
  (el, index) => {
    return (
      <span key={el}>
        <Code>.{el}</Code>
        {index < ALLOWED_STEP_EXTENSIONS.length - 1 ? <>&nbsp;, </> : ""}
      </span>
    );
  }
);

export const findFirstDiffIndex = (arrA: string[], arrB: string[]) => {
  const range = Math.min(arrA.length, arrB.length);
  let i = 0;
  while (i < range && arrA[i] === arrB[i]) i++;
  return i;
};

export const pathFromElement = (element: HTMLElement): string | undefined => {
  const path = element.getAttribute("data-path");
  if (path) {
    return path;
  } else if (element.parentElement) {
    return pathFromElement(element.parentElement);
  } else {
    return undefined;
  }
};

const getFilePathInDataFolder = (dragFilePath: string) =>
  cleanFilePath(dragFilePath);

export const getFilePathRelativeToPipeline = (
  fullFilePath: string | undefined,
  pipelineCwd: string
) => {
  if (!hasValue(fullFilePath)) {
    // By returning "/" editing the file path would always mean that
    // the "/" has to be deleted first since specifying an absolute
    // path wouldn't work.
    if (pipelineCwd === "/") {
      return "";
    }
    return pipelineCwd;
  }
  return isInDataFolder(fullFilePath)
    ? getFilePathInDataFolder(fullFilePath)
    : relative(pipelineCwd, cleanFilePath(fullFilePath));
};

/**
 * This function removes the child path if its ancestor path already appears in the list.
 * e.g. given selection ["/a/", "/a/b.py"], "/a/b.py" should be removed.
 */
export const filterRedundantChildPaths = (paths: readonly string[]) => {
  const ancestors: string[] = [];

  // Sort the list so that ancestors are traversed first.
  for (const path of [...paths].sort()) {
    const isIncluded = !ancestors.some(
      (ancestor) => hasAncestor(path, ancestor) || path === ancestor
    );

    if (isIncluded) {
      ancestors.push(path);
    }
  }

  return ancestors;
};
