import { Code } from "@/components/common/Code";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import Link from "@mui/material/Link";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import React from "react";
import { useEditJob } from "../stores/useEditJob";

export const LoadParamFileDescription = () => {
  const loadedStrategyFilePath = useEditJob(
    (state) => state.jobChanges?.loadedStrategyFilePath
  );

  return (
    <Tooltip
      title={
        <Typography variant="caption" component="span">
          {loadedStrategyFilePath ? (
            <>
              {`Loaded job parameters file: `}
              <Code>{loadedStrategyFilePath}</Code>
            </>
          ) : (
            <>
              Select a <Code>.parameters.json</Code> file to specify job
              parameters
            </>
          )}
          {` (`}
          <Link
            target="_blank"
            rel="noopener noreferrer"
            href="https://docs.orchest.io/en/stable/fundamentals/jobs.html#specify-job-parameters-with-a-file"
            sx={{ color: (theme) => theme.palette.primary.light }}
          >
            see docs
          </Link>
          ).
        </Typography>
      }
      placement="right"
      arrow
    >
      <InfoOutlinedIcon
        fontSize="small"
        color="primary"
        style={{ width: "24px", height: "24px" }}
      />
    </Tooltip>
  );
};
