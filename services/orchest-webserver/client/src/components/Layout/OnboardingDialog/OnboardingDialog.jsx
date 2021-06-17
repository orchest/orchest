// @ts-check
import React from "react";
import { m, AnimatePresence } from "framer-motion";
import {
  css,
  Box,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DIALOG_ANIMATION_DURATION,
  Flex,
  IconButton,
  IconCrossSolid,
} from "@orchest/design-system";
import { useLocalStorage } from "@/hooks/local-storage";
import { wrapNumber } from "@/utils/wrap-number";
import { onboardingDialogSlides as slides } from "./OnboardingDialogSlides";
import { MDCButtonReact } from "../../../../../../../lib/javascript/mdc/src";

const slideButton = css({ alignSelf: "center" });

const slideVariants = {
  enter:
    /** @param {number} slideDirection */
    (slideDirection) => {
      return {
        x: slideDirection > 0 ? 1000 : -1000,
        opacity: 0,
        height: 0,
      };
    },
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
    height: "auto",
  },
  exit:
    /** @param {number} slideDirection */
    (slideDirection) => {
      return {
        zIndex: 0,
        x: slideDirection < 0 ? 1000 : -1000,
        opacity: 0,
        height: 0,
      };
    },
};

/** @type React.FC<{}> */
export const OnboardingDialog = () => {
  const [isOnboarding, setIsOnboarding] = useLocalStorage("isOnboarding", true);
  const [[slideIndexState, slideDirection], setSlideIndex] = React.useState([
    0,
    0,
  ]);

  const slideIndex = wrapNumber(0, slides.length, slideIndexState);

  /** @param {number} newSlideDirection */
  const cycleSlide = (newSlideDirection) => {
    setSlideIndex(([prevSlideIndex]) => [
      prevSlideIndex + newSlideDirection,
      newSlideDirection,
    ]);
  };

  const onOpen = () => setIsOnboarding(true);
  const onClose = () => {
    setIsOnboarding(false);
    // Wait for Dialog transition to finish before resetting position.
    // This way we avoid showing the slides animating back to the start.
    setTimeout(() => setSlideIndex([0, 0]), DIALOG_ANIMATION_DURATION.OUT);
  };

  return (
    <Dialog
      open={isOnboarding}
      onOpenChange={(open) => (open ? onOpen() : onClose())}
    >
      <Box css={{ backgroundColor: "$red100", padding: "$4" }}>
        <Box as="small" css={{ display: "block", marginBottom: "$2" }}>
          Dev Mode
        </Box>
        <DialogTrigger>Open Onboarding Dialog)</DialogTrigger>
      </Box>
      <DialogContent css={{ overflow: "hidden" }}>
        <IconButton
          variant="ghost"
          rounded
          label="Close"
          onClick={() => onClose()}
          css={{ position: "absolute", top: "$4", right: "$4" }}
        >
          <IconCrossSolid />
        </IconButton>
        <AnimatePresence initial={false} custom={slideDirection}>
          {slides.map(
            (item, i) =>
              i === slideIndex && (
                <m.div
                  key={`OnboardingSlide-${i}`}
                  custom={slideDirection}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    type: "tween",
                    duration: 0.3,
                    ease: "easeInOut",
                  }}
                >
                  <DialogHeader
                    css={{ justifyContent: "center", paddingTop: "$12" }}
                  >
                    <DialogTitle>{item.title}</DialogTitle>
                  </DialogHeader>
                  <DialogBody css={{ textAlign: "center" }}>
                    {item.body}
                  </DialogBody>
                </m.div>
              )
          )}
        </AnimatePresence>
        <DialogFooter
          css={{
            paddingTop: "$8",
            paddingBottom: "$8",
            justifyContent: "center",
          }}
        >
          <Flex gap="2">
            {slideIndex === slides.length - 1 ? (
              <MDCButtonReact
                icon="open_in_new"
                label="Open Quickstart Pipeline"
                classNames={[
                  slideButton(),
                  "mdc-button--raised",
                  "themed-secondary",
                ]}
                onClick={() => onClose()}
              />
            ) : (
              <MDCButtonReact
                label="Next"
                classNames={[slideButton(), "mdc-button--outlined"]}
                onClick={() => cycleSlide(1)}
              />
            )}
          </Flex>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
