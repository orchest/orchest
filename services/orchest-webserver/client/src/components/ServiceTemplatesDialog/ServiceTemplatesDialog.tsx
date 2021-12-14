import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
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
import { IconServicesSolid } from "@orchest/design-system";
import React from "react";
import { IServiceTemplate, templates } from "./content";

export interface IServiceTemplatesDialogProps {
  onSelection?: (templateConfig: IServiceTemplate["config"]) => void;
}

export const ServiceTemplatesDialog: React.FC<IServiceTemplatesDialogProps> = ({
  onSelection,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  return (
    <>
      <Button
        startIcon={<AddIcon />}
        variant="contained"
        color="secondary"
        onClick={() => setIsOpen(true)}
        data-test-id="pipeline-service-add"
      >
        Add Service
      </Button>
      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogTitle>Select service</DialogTitle>
        <DialogContent>
          <List>
            {Object.keys(templates).map((item) => {
              const template = templates[item];
              return (
                <ListItem disablePadding key={item}>
                  <ListItemButton
                    data-test-id={`pipeline-service-template-${item}`}
                    disabled={!template.config}
                    onClick={(e) => {
                      e.preventDefault();

                      onSelection(template.config);
                      setIsOpen(false);
                    }}
                  >
                    <ListItemIcon>
                      {template?.icon || <IconServicesSolid />}
                    </ListItemIcon>
                    <ListItemText primary={template.label} />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </DialogContent>
        <DialogActions>
          <Button
            startIcon={<CloseIcon />}
            color="secondary"
            onClick={() => setIsOpen(false)}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
