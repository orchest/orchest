import {
  ProjectContextState,
  useProjectsContext,
} from "@/contexts/ProjectsContext";
import { useMounted } from "@/hooks/useMounted";
import Chip from "@mui/material/Chip";
import Fade from "@mui/material/Fade";
import React from "react";

const saveStatusMapping: Record<
  ProjectContextState["pipelineSaveStatus"],
  string
> = { saved: "Auto-saved", saving: "Saving …" };

export const SaveStatus = () => {
  const {
    state: { pipelineSaveStatus },
  } = useProjectsContext();

  const [label, setLabel] = React.useState<string>();
  const timeoutRef = React.useRef<number>();
  const statusRef = React.useRef(pipelineSaveStatus);
  const mounted = useMounted();

  React.useEffect(() => {
    if (timeoutRef.current) {
      return;
    }

    setLabel(saveStatusMapping[pipelineSaveStatus]);

    timeoutRef.current = window.setTimeout(() => {
      if (mounted.current) {
        setLabel(saveStatusMapping[statusRef.current]);
      }
      timeoutRef.current = undefined;
    }, 100);
  }, [pipelineSaveStatus, mounted]);

  statusRef.current = pipelineSaveStatus;

  return (
    <Fade in={Boolean(label)}>
      <Chip size="small" label={label} />
    </Fade>
  );
};
