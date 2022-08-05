import {
  ProjectsContextState,
  useProjectsContext,
} from "@/contexts/ProjectsContext";
import Chip from "@mui/material/Chip";
import Fade from "@mui/material/Fade";
import React from "react";

const saveStatusMapping: Record<
  ProjectsContextState["pipelineSaveStatus"],
  string
> = { saved: "Saved", saving: "Saving..." };

export const SaveStatus = () => {
  const {
    state: { pipelineSaveStatus },
  } = useProjectsContext();

  const [label, setLabel] = React.useState<string>();

  const timeout = React.useRef(0);
  React.useEffect(() => {
    setLabel(saveStatusMapping[pipelineSaveStatus]);

    if (pipelineSaveStatus === "saved") {
      window.clearTimeout(timeout.current);
      window.setTimeout(() => {
        setLabel("");
      }, 1000);
    }
  }, [pipelineSaveStatus]);

  return (
    <Fade in={Boolean(label)}>
      <Chip size="small" label={label} />
    </Fade>
  );
};
