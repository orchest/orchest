import { useAppContext } from "@/contexts/AppContext";
import { useAsync } from "@/hooks/useAsync";
import { useCheckFileValidity } from "@/hooks/useCheckFileValidity";
import { FileTree } from "@/types";
import CheckIcon from "@mui/icons-material/Check";
import WarningIcon from "@mui/icons-material/Warning";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import FilePicker from "../../components/FilePicker";
import { CreateFileDialog } from "../CreateFileDialog";

type DirectoryDetails = {
  tree: FileTree;
  cwd: string;
};

const useFileDirectoryDetails = (
  project_uuid: string,
  pipeline_uuid: string
) => {
  const { setAlert } = useAppContext();

  const { data: directoryDetails, run, error } = useAsync<DirectoryDetails>();
  const { tree, cwd } = directoryDetails || {};

  React.useEffect(() => {
    if (error) {
      setAlert("Error", `Failed to fetch file directory details: ${error}`);
    }
  }, [setAlert, error]);

  const fetchDirectoryDetails = React.useCallback(() => {
    if (project_uuid && pipeline_uuid) {
      run(
        Promise.all([
          fetcher<FileTree>(`/async/file-picker-tree/${project_uuid}`),
          fetcher<{ cwd: string }>(
            `/async/file-picker-tree/pipeline-cwd/${project_uuid}/${pipeline_uuid}`
          ).then((response) => `${response["cwd"]}/`), // FilePicker cwd expects trailing / for cwd paths
        ]).then(([tree, cwd]) => {
          return { tree, cwd };
        })
      );
    }
  }, [project_uuid, pipeline_uuid, run]);

  React.useEffect(() => {
    fetchDirectoryDetails();
  }, [fetchDirectoryDetails]);

  return { tree, cwd, fetchDirectoryDetails };
};

const ProjectFilePicker: React.FC<{
  project_uuid: string;
  pipeline_uuid: string;
  step_uuid: string;
  value: string;
  onChange: (value: string) => void;
  menuMaxWidth?: string;
}> = ({
  onChange,
  project_uuid,
  pipeline_uuid,
  step_uuid,
  value,
  menuMaxWidth,
}) => {
  // fetching data
  const { tree, cwd, fetchDirectoryDetails } = useFileDirectoryDetails(
    project_uuid,
    pipeline_uuid
  );

  const selectedFileExists = useCheckFileValidity(
    project_uuid,
    pipeline_uuid,
    value
  );

  // local states
  const [createFileModal, setCreateFileModal] = React.useState(false);

  const [createFileDir, setCreateFileDir] = React.useState("");

  const onChangeFileValue = (value: string) => onChange(value);

  const onCreateFile = (dir: string) => {
    setCreateFileModal(true);

    setCreateFileDir(dir);
  };

  const onCloseCreateFileModal = () => {
    setCreateFileModal(false);
  };

  const onFocus = () => fetchDirectoryDetails();

  return (
    <>
      <CreateFileDialog
        isOpen={createFileModal}
        onClose={onCloseCreateFileModal}
        initialFileName={value}
        projectUuid={project_uuid}
        pipelineUuid={pipeline_uuid}
        stepUuid={step_uuid}
        folderPath={createFileDir}
      />
      {cwd && tree && (
        <FilePicker
          tree={tree}
          cwd={cwd}
          onFocus={onFocus}
          value={value}
          icon={
            selectedFileExists ? (
              <CheckIcon color="success" />
            ) : (
              <WarningIcon color="warning" />
            )
          }
          helperText={
            selectedFileExists
              ? "File exists in the project directory."
              : "Warning: this file wasn't found in the project directory."
          }
          onCreateFile={onCreateFile}
          onChangeValue={onChangeFileValue}
          menuMaxWidth={menuMaxWidth}
        />
      )}
    </>
  );
};

export default ProjectFilePicker;
