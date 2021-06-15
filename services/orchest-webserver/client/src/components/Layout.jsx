// @ts-check
import React from "react";
import {
  Box,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Flex,
  IconButton,
  IconChevronRightOutline,
} from "@orchest/design-system";

/** @type React.FC<{}> */
export const Layout = (props) => {
  return (
    <React.Fragment>
      {props.children}
      <Dialog>
        <Box css={{ backgroundColor: "$red100", padding: "$4" }}>
          <DialogTrigger>Open Onboarding Dialog)</DialogTrigger>
          <Box as="small" css={{ display: "block", paddingTop: "$2" }}>
            (for development purposes only)
          </Box>
        </Box>
        <DialogContent>
          <DialogHeader css={{ justifyContent: "center" }}>
            <DialogTitle>Discover Orchest</DialogTitle>
          </DialogHeader>
          <DialogBody css={{ textAlign: "center", justifyContent: "center" }}>
            Find out more about the core concepts.
          </DialogBody>
          <DialogFooter css={{ justifyContent: "center" }}>
            <Flex gap="2">
              <IconButton rounded size="4" label="Next">
                <IconChevronRightOutline />
              </IconButton>
            </Flex>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </React.Fragment>
  );
};
