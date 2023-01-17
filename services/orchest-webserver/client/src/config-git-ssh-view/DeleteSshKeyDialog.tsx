import { useGitConfigsApi } from "@/api/git-configs/useGitConfigsApi";
import { BoldText } from "@/components/common/BoldText";
import { useAsync } from "@/hooks/useAsync";
import { SshKey } from "@/types";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import React from "react";

type DeleteSshKeyDialogProps = {
  sshKey: SshKey | undefined;
  close: () => void;
};

export const DeleteSshKeyDialog = ({
  sshKey,
  close,
}: DeleteSshKeyDialogProps) => {
  const deleteSshKey = useGitConfigsApi((state) => state.deleteSshKey);
  const { run, status } = useAsync();

  const removeSshKey = async () => {
    if (!sshKey) return;
    await run(deleteSshKey(sshKey.uuid));
  };

  const closeDialog = status !== "PENDING" ? close : undefined;

  return (
    <Dialog open={Boolean(sshKey)} onClose={closeDialog}>
      <DialogTitle>Delete SSH Key</DialogTitle>
      <DialogContent>
        {`Are you sure that you want to delete SSH key `}
        <BoldText>{sshKey?.name}</BoldText>?
      </DialogContent>
      <DialogActions>
        <Button onClick={closeDialog}>Keep SSH key</Button>
        <Button
          variant="contained"
          onClick={removeSshKey}
          color="error"
          disabled={status === "PENDING"}
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
};
