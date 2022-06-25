import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useMatchRoutePaths } from "@/hooks/useMatchProjectRoot";
import { siteMap, withinProjectPaths } from "@/routingConfig";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useProjectSelector } from "./useProjectSelector";

export const ProjectSelectorToggle = ({
  onClick,
  isOpen,
}: {
  onClick: () => void;
  isOpen: boolean;
}) => {
  const { projectUuid: projectUuidFromRoute, navigateTo } = useCustomRoute();

  const customNavigateTo = React.useCallback(
    (projectUuid: string, path: string | undefined) => {
      navigateTo(path || siteMap.pipeline.path, { query: { projectUuid } });
    },
    [navigateTo]
  );

  const matchWithinProjectPaths = useMatchRoutePaths(withinProjectPaths);

  const { validProjectUuid, projects = [] } = useProjectSelector(
    projectUuidFromRoute,
    matchWithinProjectPaths?.root || matchWithinProjectPaths?.path,
    customNavigateTo
  );

  const projectName = React.useMemo(() => {
    const found = projects.find((project) => project.uuid === validProjectUuid);
    return found?.path;
  }, [projects, validProjectUuid]);

  return (
    <Button
      onClick={onClick}
      id="navigation-toggle"
      sx={{
        height: (theme) => theme.spacing(7),
        width: (theme) => theme.spacing(32),
        borderRadius: 0,
        padding: 0,
        justifyContent: "flex-start",
        backgroundColor: (theme) =>
          isOpen ? theme.palette.action.hover : "unset",
      }}
      disableRipple
    >
      <Stack direction="row" alignItems="center" sx={{ width: "100%" }}>
        <Box
          component="img"
          src="/image/logo.svg"
          data-test-id="orchest-logo"
          sx={{
            width: (theme) => theme.spacing(3.25),
            height: (theme) => theme.spacing(3.25),
            margin: (theme) => theme.spacing(0, 2),
          }}
        />
        <Stack
          direction="column"
          justifyContent="center"
          alignItems="flex-start"
          spacing={0.25}
          sx={{ flex: 1 }}
        >
          <Typography
            variant="caption"
            sx={{
              color: (theme) => theme.palette.text.secondary,
              fontWeight: (theme) => theme.typography.fontWeightMedium,
              lineHeight: 1,
            }}
          >
            {projectName ? "PROJECT" : "CHOOSE PROJECT"}
          </Typography>
          {hasValue(projectName) && (
            <Typography
              variant="body1"
              sx={{
                textTransform: "initial",
                lineHeight: 1,
                color: (theme) => theme.palette.common.black,
              }}
            >
              {projectName}
            </Typography>
          )}
        </Stack>
        <ArrowDropDownIcon
          sx={{
            marginRight: (theme) => theme.spacing(1),
            color: (theme) => theme.palette.action.active,
          }}
        />
        <Divider
          orientation="vertical"
          flexItem
          sx={{ height: (theme) => theme.spacing(4.5) }}
        />
      </Stack>
    </Button>
  );
};
