import { useProjectsApi } from "@/api/projects/useProjectsApi";
import { ErrorSummary } from "@/components/common/ErrorSummary";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { useNavigate } from "@/hooks/useCustomRoute";
import { useReviewProjectName } from "@/hooks/useReviewProjectName";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import React from "react";

export type NewProjectForm = { onCreated?: () => void; onCancel: () => void };

export const NewProjectForm = ({ onCreated, onCancel }) => {
  const { setAlert } = useGlobalContext();
  const navigate = useNavigate();

  const createProject = useProjectsApi((api) => api.create);
  const [name, setName] = React.useState("");
  const remarks = useReviewProjectName(name);

  const onSubmit = async () => {
    if (remarks) return;

    try {
      const newProject = await createProject(name);

      onCreated?.();

      navigate({
        route: "pipeline",
        sticky: false,
        query: { projectUuid: newProject.uuid },
      });
    } catch (error) {
      setAlert("Failed to create project", <ErrorSummary error={error} />);
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <TextField
        fullWidth
        autoFocus
        required
        label="Project name"
        data-test-id="new-project-dialog-name-input"
        value={name}
        onChange={(event) =>
          setName(event.target.value.replace(/[^\w\.]/g, "-"))
        }
        sx={{ marginTop: (theme) => theme.spacing(2) }}
        error={Boolean(name.length > 0 && remarks)}
        helperText={name.length > 0 ? remarks || " " : " "}
      />

      <Stack
        direction="row"
        justifyContent="flex-end"
        spacing={1}
        marginTop={2}
      >
        <Button tabIndex={-1} onClick={() => onCancel()}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={Boolean(remarks)}
          data-test-id="create-project-dialog-submit-button"
        >
          Create project
        </Button>
      </Stack>
    </form>
  );
};
