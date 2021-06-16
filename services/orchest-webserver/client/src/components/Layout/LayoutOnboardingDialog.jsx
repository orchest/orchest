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
  IconCrossSolid,
} from "@orchest/design-system";
import { useLocalStorage } from "@/hooks/local-storage";

/** @type React.FC<{}> */
export const LayoutOnboardingDialog = (props) => {
  const [isOnboarding, setIsOnboarding] = useLocalStorage("isOnboarding", true);

  return (
    <Dialog open={isOnboarding} onOpenChange={(open) => setIsOnboarding(open)}>
      <Box css={{ backgroundColor: "$red100", padding: "$4" }}>
        <Box as="small" css={{ display: "block", marginBottom: "$2" }}>
          Dev Mode
        </Box>
        <DialogTrigger>Open Onboarding Dialog)</DialogTrigger>
      </Box>
      <DialogContent>
        <IconButton
          variant="ghost"
          rounded
          label="Close"
          onClick={() => setIsOnboarding(false)}
          css={{ position: "absolute", top: "$4", right: "$4" }}
        >
          <IconCrossSolid />
        </IconButton>
        <DialogHeader css={{ paddingTop: "$12", justifyContent: "center" }}>
          <DialogTitle>Discover Orchest</DialogTitle>
        </DialogHeader>
        <DialogBody css={{ textAlign: "center", justifyContent: "center" }}>
          Find out more about the core concepts.
        </DialogBody>
        <DialogFooter
          css={{
            paddingTop: "$8",
            paddingBottom: "$8",
            justifyContent: "center",
          }}
        >
          <Flex gap="2">
            <IconButton rounded size="4" label="Next">
              <IconChevronRightOutline />
            </IconButton>
          </Flex>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
