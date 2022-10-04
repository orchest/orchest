import { useGlobalContext } from "@/contexts/GlobalContext";
import { useCreateEnvironment } from "@/environments-view/hooks/useCreateEnvironment";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import { Language } from "@/types";
import { capitalize } from "@/utils/text";
import AddIcon from "@mui/icons-material/Add";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import React from "react";

type StepCreateEnvironmentButtonProps = {
  language: Language;
  visible: boolean;
};

export const StepCreateEnvironmentButton = ({
  language,
  visible,
}: StepCreateEnvironmentButtonProps) => {
  const { navigateTo, projectUuid } = useCustomRoute();
  const { setAlert } = useGlobalContext();
  const { createEnvironment, canCreateEnvironment } = useCreateEnvironment();
  const createEnvironmentAndRedirect = async () => {
    try {
      const environment = await createEnvironment(
        language,
        capitalize(language)
      );

      navigateTo(siteMap.environments.path, {
        query: { projectUuid, environmentUuid: environment?.uuid },
      });
    } catch (error) {
      setAlert("Notice", `Unable to create new Environment. ${String(error)}`);
      navigateTo(siteMap.environments.path, { query: { projectUuid } });
    }
  };

  return visible ? (
    <FormControl fullWidth>
      <Button
        startIcon={<AddIcon />}
        disabled={!canCreateEnvironment}
        sx={{ height: (theme) => theme.spacing(7) }}
        onClick={createEnvironmentAndRedirect}
      >
        New Environment
      </Button>
    </FormControl>
  ) : null;
};
