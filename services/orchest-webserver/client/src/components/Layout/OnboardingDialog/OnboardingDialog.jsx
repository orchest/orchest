// @ts-check
import React from "react";
import { m, AnimatePresence } from "framer-motion";
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
  IconChevronLeftOutline,
  IconChevronRightOutline,
  IconCrossSolid,
} from "@orchest/design-system";
import { useLocalStorage } from "@/hooks/local-storage";
import { onboardingDialogSlides as slides } from "./OnboardingDialogSlides";

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
  const [[slideIndex, slideDirection], setSlideIndex] = React.useState([0, 0]);

  /** @param {number} newSlideDirection */
  const cycleSlide = (newSlideDirection) => {
    setSlideIndex(([prevSlideIndex]) => {
      if (prevSlideIndex <= 0) {
        return [
          newSlideDirection === -1
            ? slides.length + newSlideDirection
            : prevSlideIndex + newSlideDirection,
          newSlideDirection,
        ];
      }

      return [
        (prevSlideIndex + newSlideDirection) % slides.length,
        newSlideDirection,
      ];
    });
  };

  return (
    <Dialog open={isOnboarding} onOpenChange={(open) => setIsOnboarding(open)}>
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
          onClick={() => setIsOnboarding(false)}
          css={{ position: "absolute", top: "$4", right: "$4" }}
        >
          <IconCrossSolid />
        </IconButton>
        <AnimatePresence initial={false}>
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
            <IconButton
              rounded
              size="4"
              label="Next"
              onClick={() => cycleSlide(-1)}
            >
              <IconChevronLeftOutline />
            </IconButton>
            <IconButton
              rounded
              size="4"
              label="Next"
              onClick={() => cycleSlide(1)}
            >
              <IconChevronRightOutline />
            </IconButton>
          </Flex>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
