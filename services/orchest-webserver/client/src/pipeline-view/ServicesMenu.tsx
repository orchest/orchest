import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/routingConfig";
import { Service } from "@/types";
import { getServiceURLs } from "@/utils/webserver-utils";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import TuneIcon from "@mui/icons-material/Tune";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import Menu from "@mui/material/Menu";
import Typography from "@mui/material/Typography";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

const formatUrl = (url: string) => {
  return "Port " + url.split("/")[3].split("_").slice(-1)[0];
};

export const ServicesMenu = ({
  isOpen,
  onClose,
  anchor,
  services,
}: {
  isOpen: boolean;
  onClose: () => void;
  anchor: React.MutableRefObject<Element | null>;
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

  const isJobRun = hasValue(jobUuid && runUuid);

  const openSettings = (e: React.MouseEvent) => {
    navigateTo(
      isJobRun
        ? siteMap.jobRunPipelineSettings.path
        : siteMap.pipelineSettings.path,
      {
        query: {
          projectUuid,
          pipelineUuid,
          jobUuid,
          runUuid: runUuid,
          initialTab: "services",
        },
        state: { isReadOnly },
      },
      e
    );
  };

  const serviceLinks =
    services && projectUuid && pipelineUuid
      ? Object.entries(services)
          .filter((serviceTuple) => serviceTuple[1].exposed)
          .map(([serviceName, service]) => {
            return {
              name: serviceName,
              urls: getServiceURLs(service, projectUuid, pipelineUuid, runUuid),
            };
          })
      : null;

  return (
    <Menu
      id="running-services-menu"
      anchorEl={anchor.current}
      open={isOpen}
      onClose={onClose}
      MenuListProps={{
        "aria-labelledby": "running-services-button",
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
      <ListItem>
        <Typography
          variant="subtitle1"
          component="h3"
          sx={{ paddingBottom: 0 }}
        >
          Running services
        </Typography>
      </ListItem>
      {serviceLinks && serviceLinks.length > 0 ? (
        serviceLinks.map((serviceLink) => {
          return (
            <List
              key={serviceLink.name}
              subheader={<ListSubheader>{serviceLink.name}</ListSubheader>}
            >
              {serviceLink.urls.length === 0 && (
                <ListItem>
                  <Typography variant="caption">
                    <i>This service has no endpoints.</i>
                  </Typography>
                </ListItem>
              )}
              {serviceLink.urls.map((url) => {
                return (
                  <ListItemButton
                    key={url}
                    component="a"
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ListItemIcon>
                      <OpenInNewIcon />
                    </ListItemIcon>
                    <ListItemText primary={formatUrl(url)} />
                  </ListItemButton>
                );
              })}
            </List>
          );
        })
      ) : (
        <ListItem>
          <ListItemText secondary={<i>No services are running.</i>} />
        </ListItem>
      )}
      <Divider />
      <List>
        <ListItemButton onClick={openSettings} onAuxClick={openSettings}>
          <ListItemIcon>
            <TuneIcon />
          </ListItemIcon>
          <ListItemText primary={`${!isReadOnly ? "Edit" : "View"} services`} />
        </ListItemButton>
      </List>
    </Menu>
  );
};
