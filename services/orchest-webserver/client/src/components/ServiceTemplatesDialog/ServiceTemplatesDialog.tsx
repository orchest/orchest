import * as React from "react";
import {
  css,
  styled,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Flex,
  IconServicesSolid,
} from "@orchest/design-system";
import { MDCButtonReact } from "@orchest/lib-mdc";
import { templates, IServiceTemplate } from "./content";

// we'll extract this into the design-system later
const CreateServiceButton = styled("button", {
  appearance: "none",
  display: "inline-flex",
  backgroundColor: "$background",
  border: "1px solid $gray300",
  borderRadius: "$sm",
  width: "100%",
  padding: "$3",
  transition: "0.2s ease",
  textAlign: "left",
  "&:hover&:not(:disabled)": {
    backgroundColor: "$gray100",
  },
  "> *:first-child": {
    flexShrink: 0,
    color: "$gray600",
    marginRight: "$3",
  },
});

export interface IServiceTemplatesDialogProps {
  onSelection?: (templateConfig: IServiceTemplate["config"]) => void;
}

export const ServiceTemplatesDialog: React.FC<IServiceTemplatesDialogProps> = ({
  onSelection,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <MDCButtonReact
        icon="add"
        classNames={["mdc-button--raised", "themed-primary"]}
        label="Add Service"
        onClick={() => setIsOpen(true)}
        data-test-id="pipeline-service-add"
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a service</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Flex as="ul" direction="column" gap="2">
            {Object.keys(templates).map((item) => {
              const template = templates[item];
              return (
                <li key={item}>
                  <CreateServiceButton
                    disabled={!template.config}
                    onClick={(e) => {
                      e.preventDefault();

                      onSelection(template.config);
                      setIsOpen(false);
                    }}
                    data-test-id={`pipeline-service-template-${item}`}
                  >
                    {template?.icon || <IconServicesSolid />}
                    {template.label}
                  </CreateServiceButton>
                </li>
              );
            })}
          </Flex>
        </DialogBody>
        <DialogFooter>
          <MDCButtonReact
            icon="close"
            label="Cancel"
            onClick={() => setIsOpen(false)}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
