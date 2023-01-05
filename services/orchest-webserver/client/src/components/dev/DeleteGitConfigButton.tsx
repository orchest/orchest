import { gitConfigsApi } from "@/api/git-configs/gitConfigsApi";
import {
  getAuthUserUuid,
  useGitConfigsApi,
} from "@/api/git-configs/useGitConfigsApi";
import Button from "@mui/material/Button";
import React from "react";

/** Delete the git config of the user. Only used for testing purposes. */
export const DeleteGitConfigButton = () => {
  const gitConfigUuid = useGitConfigsApi((state) => state.config?.uuid);

  return (
    <Button
      onClick={() => {
        if (!gitConfigUuid) {
          console.error("User is not yet logged in.");
          return;
        }
        gitConfigsApi.deleteGitConfig(getAuthUserUuid(), gitConfigUuid);
      }}
    >
      Delete git config
    </Button>
  );
};
