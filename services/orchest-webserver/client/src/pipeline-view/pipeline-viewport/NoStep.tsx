import { EmptyState } from "@/components/common/EmptyState";
import { UploadFilesForm } from "@/components/UploadFilesForm";
import { useCancelableFetch } from "@/hooks/useCancelablePromise";
import { useUploader } from "@/hooks/useUploader";
import { NoteAddOutlined, UploadFileOutlined } from "@mui/icons-material";
import Button from "@mui/material/Button";
import React from "react";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { lastSelectedFolderPath } from "../file-manager/common";
import { CreateFileDialog } from "../file-manager/CreateFileDialog";
import { useFileManagerContext } from "../file-manager/FileManagerContext";
import { useCreateStep } from "../hooks/useCreateStep";

export const NoStep = () => {
  const { selectedFiles, fetchFileTrees } = useFileManagerContext();
  const { isReadOnly, pipeline, projectUuid } = usePipelineDataContext();
  const createStep = useCreateStep();
  const [isFileDialogOpen, setIsFileDialogOpen] = React.useState(false);
  const { cancelableFetch } = useCancelableFetch();
  const uploader = useUploader({
    projectUuid,
    root: "/project-dir",
    fetch: cancelableFetch,
  });

  const handleFileUpload = (files: FileList | File[]) =>
    uploader
      .uploadFiles(lastSelectedFolderPath(selectedFiles), files)
      .then(() => fetchFileTrees());

  return (
    <>
      <EmptyState
        imgSrc="/image/files.svg"
        title="No scripts or notebooks"
        description={`There are no files in this Project yet. Create or upload a file to get started.`}
        actions={
          <>
            <Button
              disabled={isReadOnly}
              onClick={() => setIsFileDialogOpen(true)}
              startIcon={<NoteAddOutlined />}
              variant="contained"
            >
              New file
            </Button>
            <UploadFilesForm multiple upload={handleFileUpload}>
              {(onClick) => (
                <Button
                  disabled={isReadOnly}
                  onClick={onClick}
                  startIcon={<UploadFileOutlined />}
                >
                  Upload files
                </Button>
              )}
            </UploadFilesForm>
          </>
        }
      />
      <CreateFileDialog
        isOpen={!isReadOnly && isFileDialogOpen}
        canCreateStep={Boolean(pipeline)}
        root="/project-dir"
        onClose={() => setIsFileDialogOpen(false)}
        onSuccess={(file) => {
          if (file.shouldCreateStep) {
            createStep(file.projectPath);
          }
          fetchFileTrees();
        }}
      />
    </>
  );
};
