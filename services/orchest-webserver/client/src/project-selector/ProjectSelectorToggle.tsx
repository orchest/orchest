import { useActiveProject } from "@/hooks/useActiveProject";
import { isProjectPage } from "@/routingConfig";
import { ellipsis } from "@/utils/styles";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import Button from "@mui/material/Button";
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
  const projectName = isProjectPage(pathname) ? activeProject?.path : undefined;

  return (
    <Button
      onClick={onClick}
      tabIndex={tabIndex}
      data-test-id="project-selector"
      id="navigation-toggle"
      sx={{
        height: (theme) => theme.spacing(7),
        minWidth: "130px",
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
      <Stack
        direction="column"
        justifyContent="center"
        alignItems="flex-start"
        sx={{ flex: 1, paddingLeft: 2, paddingRight: 3 }}
      >
        <Typography variant="button" color="text.secondary" lineHeight={1}>
          PROJECT
        </Typography>
        {hasValue(projectName) && (
          <Typography
            variant="body1"
            title={projectName}
            sx={{
              ...ellipsis(),
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
    </Button>
  );
};
