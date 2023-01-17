import { useNavigate } from "@/hooks/useCustomRoute";
import { useToggle } from "@/hooks/useToggle";
import DownloadOutlined from "@mui/icons-material/DownloadOutlined";
import Button, { ButtonProps } from "@mui/material/Button";
import React from "react";
import { ImportProjectDialog, ProjectIdentifiers } from "./ImportProjectDialog";
import { ImportSuccessDialog } from "./ImportSuccessDialog";

export type ImportProjectButtonProps = ButtonProps & {
  showSuccessDialog?: boolean;
  importUrl?: string;
};

export const ImportProjectButton = React.forwardRef<
  HTMLButtonElement,
  ImportProjectButtonProps
>(function ImportProjectButton(
  { children = "Import", importUrl, showSuccessDialog, ...buttonProps },
  ref
) {
  const [dialogOpen, toggleDialog] = useToggle();
  const [imported, setImported] = React.useState<ProjectIdentifiers>();
  const navigate = useNavigate();

  return (
    <>
      <Button
        ref={ref}
        variant="text"
        startIcon={<DownloadOutlined />}
        onClick={() => toggleDialog(true)}
        sx={{ flex: 1 }}
        data-test-id="import-project-button"
        {...buttonProps}
      >
        {children}
      </Button>

      {dialogOpen && (
        <ImportProjectDialog
          open={dialogOpen}
          importUrl={importUrl}
          onClose={() => toggleDialog(false)}
          onImported={(newProject) => {
            toggleDialog(false);

            if (showSuccessDialog) {
              setImported(newProject);
            } else {
              navigate({
                route: "pipeline",
                query: { projectUuid: newProject.uuid },
                sticky: false,
              });
            }
          }}
        />
      )}

      {imported && (
        <ImportSuccessDialog
          open={true}
          project={imported}
          onClose={() => setImported(undefined)}
        />
      )}
    </>
  );
});
