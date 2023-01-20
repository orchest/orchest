import { useFetchExamples } from "@/hooks/useFetchExamples";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import React from "react";

export const GoToExamplesButton = ({ onClick }: { onClick: () => void }) => {
  const { examples } = useFetchExamples();
  const examplesCountString = React.useMemo(() => {
    if (!examples) return null;
    return examples.length > 99 ? "99+" : examples.length.toString();
  }, [examples]);

  return (
    <Button
      variant="text"
      tabIndex={0}
      data-test-id="project-drawer/examples"
      sx={{
        flex: 1,
        borderRadius: 0,
        height: (theme) => theme.spacing(5),
        verticalAlign: "middle",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
      }}
      onClick={onClick}
    >
      {`Examples`}
      {examplesCountString && (
        <Chip
          label={examplesCountString}
          size="small"
          color="primary"
          sx={{ marginLeft: (theme) => theme.spacing(1) }}
        />
      )}
    </Button>
  );
};
