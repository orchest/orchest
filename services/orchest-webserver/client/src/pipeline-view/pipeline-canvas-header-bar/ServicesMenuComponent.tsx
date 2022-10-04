import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import { Service } from "@/types";
import { getServiceURLs } from "@/utils/webserver-utils";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import TuneIcon from "@mui/icons-material/Tune";
import Divider from "@mui/material/Divider";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import MenuList from "@mui/material/MenuList";
import Typography from "@mui/material/Typography";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { usePipelineCanvasContext } from "../contexts/PipelineCanvasContext";

const formatUrl = (url: string) => {
  return "Port " + url.split("/")[3].split("_").slice(-1)[0];
};

export const ServicesMenuComponent = ({
  onClose,
  anchor,
  services,
}: {
  onClose: () => void;
  anchor: Element | undefined;
  services: Record<string, Partial<Service>> | null;
}) => {
  const {
    projectUuid,
    pipelineUuid,
    runUuid,
    isReadOnly,
    jobUuid,
    navigateTo,
  } = useCustomRoute();

  const { setFullscreenTab } = usePipelineCanvasContext();

  const openSettings = () => {
    setFullscreenTab("services");
    onClose();
  };

  const openSettingsInNewTab = (e: React.MouseEvent) => {
    navigateTo(
      siteMap.pipeline.path,
      {
        query: {
          projectUuid,
          pipelineUuid,
          jobUuid,
          runUuid,
          tab: "services",
        },
        state: { isReadOnly },
      },
      e
    );
    onClose();
  };

  const serviceLinks =
    services && projectUuid && pipelineUuid
      ? Object.entries(services).map(([serviceName, service]) => {
          return {
            name: serviceName,
            urls: getServiceURLs(service, projectUuid, pipelineUuid, runUuid),
            exposed: service.exposed,
          };
        })
      : null;

  return (
    <Menu
      id="running-services-menu"
      anchorEl={anchor}
      open={hasValue(anchor)}
      onClose={onClose}
      MenuListProps={{
        dense: true,
        "aria-labelledby": "running-services",
      }}
      anchorOrigin={{
        vertical: "bottom",
        horizontal: "center",
      }}
      transformOrigin={{
        vertical: "top",
        horizontal: "center",
      }}
    >
      <ListSubheader
        sx={{
          color: (theme) => theme.palette.common.black,
          margin: (theme) => theme.spacing(0.5, 0, -1.5),
        }}
      >
        Running services
      </ListSubheader>
      {serviceLinks && serviceLinks.length > 0 ? (
        serviceLinks.map((serviceLink) => {
          const serviceStatusMessage = !serviceLink.exposed
            ? `Not exposed.`
            : serviceLink.urls.length === 0
            ? `No endpoints.`
            : null;
          return (
            <MenuList
              dense
              key={serviceLink.name}
              subheader={<ListSubheader>{serviceLink.name}</ListSubheader>}
            >
              {serviceStatusMessage && (
                <MenuItem disabled sx={{ opacity: `0.8 !important` }}>
                  <Typography variant="caption" sx={{ fontStyle: "italic" }}>
                    {serviceStatusMessage}
                  </Typography>
                </MenuItem>
              )}

              {serviceLink.exposed &&
                serviceLink.urls.map((url) => {
                  return (
                    <MenuItem
                      key={url}
                      component="a"
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ListItemIcon>
                        <OpenInNewIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>{formatUrl(url)}</ListItemText>
                    </MenuItem>
                  );
                })}
            </MenuList>
          );
        })
      ) : (
        <ListItem>
          <ListItemText secondary={<i>No services are running.</i>} />
        </ListItem>
      )}
      <Divider />
      <MenuList dense>
        <MenuItem onClick={openSettings} onAuxClick={openSettingsInNewTab}>
          <ListItemIcon>
            <TuneIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{`${
            !isReadOnly ? "Edit" : "View"
          } services`}</ListItemText>
        </MenuItem>
      </MenuList>
    </Menu>
  );
};
