import { EnvironmentBuild } from "@/types";
import { formatServerDateTime } from "@/utils/webserver-utils";
import { SxProps, Theme } from "@mui/material";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import React from "react";

export const ImageBuildStatus = ({
  build,
  sx,
}: {
  build: EnvironmentBuild | undefined;
  sx?: SxProps<Theme>;
}) => {
  const complete = build?.status === "SUCCESS";
  return build ? (
    <Stack sx={sx} direction="column">
      <div className="build-notice push-down">
        <div data-test-id="environments-build-status">
          <span className="build-label">Build status:</span>
          {build.status}
        </div>
        <div>
          <span className="build-label">Build requested:</span>
          {build.requested_time ? (
            formatServerDateTime(build.requested_time)
          ) : (
            <i>not yet requested</i>
          )}
        </div>
        <div>
          <span className="build-label">Build finished:</span>
          {build.finished_time ? (
            formatServerDateTime(build.finished_time)
          ) : (
            <i>not yet finished</i>
          )}
        </div>
      </div>
      <LinearProgress
        value={complete ? 100 : undefined}
        variant={complete ? "determinate" : "indeterminate"}
        sx={{ minHeight: (theme) => theme.spacing(0.5) }}
      />
    </Stack>
  ) : null;
};
