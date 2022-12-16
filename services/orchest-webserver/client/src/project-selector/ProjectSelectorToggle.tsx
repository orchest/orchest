import { useActiveProject } from "@/hooks/useActiveProject";
import { siteMap } from "@/routingConfig";
import { ellipsis } from "@/utils/styles";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import { alpha } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useLocation } from "react-router-dom";

type ProjectSelectorToggleProps = {
  tabIndex?: number;
  onClick: () => void;
  isOpen: boolean;
};

export const ProjectSelectorToggle = ({
  tabIndex,
  onClick,
  isOpen,
}: ProjectSelectorToggleProps) => {
  const { pathname } = useLocation();
  const activeProject = useActiveProject();
  const projectName =
    pathname === siteMap.projects.path ? undefined : activeProject?.path;

  return (
    <Button
      onClick={onClick}
      tabIndex={tabIndex}
      data-test-id="project-selector"
      id="navigation-toggle"
      sx={{
        height: (theme) => theme.spacing(7),
        width: (theme) => theme.spacing(32),
        borderRadius: 0,
        padding: 0,
        justifyContent: "flex-start",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: (theme) =>
          isOpen ? alpha(theme.palette.primary.light, 0.1) : "unset",
        ":hover, :focus": {
          backgroundColor: (theme) =>
            isOpen
              ? alpha(theme.palette.primary.light, 0.2)
              : theme.palette.action.hover,
        },
      }}
      disableRipple
    >
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
            title={projectName}
            sx={{
              ...ellipsis((theme) => theme.spacing(20.5)),
              textTransform: "initial",
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
        sx={{ height: (theme) => theme.spacing(4.5) }}
      />
    </Button>
  );
};
