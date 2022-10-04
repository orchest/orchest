import CloseIcon from "@mui/icons-material/Close";
import MiscellaneousServicesIcon from "@mui/icons-material/MiscellaneousServices";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import React from "react";
import { ServiceTemplate, templates } from "./content";

export const ServiceTemplatesDialog: React.FC<{
  onSelection: (templateConfig: ServiceTemplate["config"]) => void;
  children: (onClick: () => void) => React.ReactNode;
}> = ({ onSelection, children }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const onClick = React.useCallback(() => setIsOpen(true), []);
  return (
    <>
      {children(onClick)}
      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogTitle>Select service</DialogTitle>
        <DialogContent>
          <List>
            {Object.entries(templates).map(([key, template]) => {
              return (
                <ListItem disablePadding key={key}>
                  <ListItemButton
                    data-test-id={`pipeline-service-template-${key}`}
                    disabled={!template.config}
                    onClick={(e) => {
                      e.preventDefault();

                      onSelection(template.config);
                      setIsOpen(false);
                    }}
                  >
                    <ListItemIcon>
                      {template?.icon || (
                        <MiscellaneousServicesIcon fontSize="small" />
                      )}
                    </ListItemIcon>
                    <ListItemText primary={template.label} />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </DialogContent>
        <DialogActions>
          <Button startIcon={<CloseIcon />} onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
