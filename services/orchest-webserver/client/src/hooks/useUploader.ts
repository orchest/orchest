import { FILE_MANAGEMENT_ENDPOINT } from "@/pipeline-view/file-manager/common";
import { FileRoot } from "@/utils/file";
import { join } from "@/utils/path";
import { prune } from "@/utils/record";
import { queryArgs } from "@/utils/text";
import { fetcher, Fetcher, hasValue } from "@orchest/lib-utils";
import React from "react";
import { FileWithPath } from "react-dropzone";

export type FileWithValidPath = FileWithPath & { readonly path: string };

/**
 * this function determines if the given file is a file uploaded via useDropzone
 * if true, the file has a property "path"
 * @param file {File | FileWithPath}
 * @returns {boolean}
 */
export function isUploadedViaDropzone(
  file: File | FileWithPath
): file is FileWithValidPath {
  return hasValue((file as FileWithPath).path);
}

type UploadFileParams = {
  projectUuid?: string;
  root: FileRoot;
  isProjectUpload?: boolean;
  fetch?: Fetcher;
};

export const useUploader = ({
  projectUuid,
  root,
  isProjectUpload,
  fetch,
}: UploadFileParams) => {
  const [inProgress, setInProgress] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  const reset = React.useCallback(() => setInProgress(false), []);

  const uploadFiles = React.useCallback(
    async (basePath: string, files: File[] | FileList) => {
      setProgress(0);

      const upload = createUploader({
        projectUuid,
        root,
        basePath,
        isProjectUpload,
        fetch,
      });

      let progressTotal = files.length;
      const progressHolder = { progress: 0 };

      setInProgress(true);

      await Promise.all(
        upload(files, () => {
          progressHolder.progress += 1;
          const progressPercentage = Math.round(
            (progressHolder.progress / progressTotal) * 100
          );
          setProgress(progressPercentage);
        })
      );

      setInProgress(false);
    },
    [projectUuid, root, isProjectUpload, fetch]
  );

  return { uploadFiles, progress, inProgress, reset };
};

export type CreateUploaderParams = {
  projectUuid?: string;
  root: FileRoot;
  basePath: string;
  isProjectUpload?: boolean;
  fetch?: Fetcher<void>;
};

type Uploader = (
  files: File[] | FileList,
  onUploaded?: (completedCount: number, totalCount: number) => void
) => Promise<void>[];

export const createUploader = ({
  projectUuid,
  root,
  basePath,
  isProjectUpload,
  fetch = fetcher,
}: CreateUploaderParams): Uploader => (files, onUploaded) => {
  // ensure that we are handling File[] instead of FileList
  const fileArray = Array.from(files);

  let completedCount = 0;

  return fileArray.map(async (file: File | FileWithValidPath) => {
    // Derive folder to upload the file to if webkitRelativePath includes a slash
    // (means the file was uploaded as a folder through drag or folder file selection)
    const isUploadedAsFolder = isUploadedViaDropzone(file)
      ? /.+\/.+/.test(file.path)
      : file.webkitRelativePath !== undefined &&
        file.webkitRelativePath.includes("/");

    let path = !isUploadedAsFolder
      ? basePath
      : `${basePath}${(isUploadedViaDropzone(file)
          ? file.path
          : file.webkitRelativePath
        )
          .split("/")
          .slice(0, -1)
          .filter((value) => value.length > 0)
          // Do not nest the project directory content.
          .slice(isProjectUpload ? 1 : 0)
          .join("/")}`;

    if (isUploadedAsFolder && !path.endsWith("/")) {
      path = path + "/";
    }

    const formData = new FormData();
    formData.append("file", file);

    const query = prune({ root, path, project_uuid: projectUuid });
    const url =
      join(FILE_MANAGEMENT_ENDPOINT, "upload") + "?" + queryArgs(query);

    await fetch(url, { method: "POST", body: formData });

    completedCount += 1;

    onUploaded?.(completedCount, fileArray.length);
  });
};
