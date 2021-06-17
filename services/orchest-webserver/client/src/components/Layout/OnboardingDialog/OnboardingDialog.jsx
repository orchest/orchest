// @ts-check
import React from "react";
import { m, AnimatePresence } from "framer-motion";
import { MDCButtonReact } from "@orchest/lib-mdc";
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
  IconButton,
  IconCrossSolid,
  Text,
} from "@orchest/design-system";
import { useLocalStorage } from "@/hooks/local-storage";
import { wrapNumber } from "@/utils/wrap-number";
import { PipelineDiagram } from "./PipelineDiagram";
import { slides } from "./content";

const iconList = css({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(0, 1fr))",
  gridAutoFlow: "column",
});

const iconListItem = css({
  display: "flex",
  flexDirection: "column",
  fontSize: "$sm",
  "> i": { fontSize: "2rem", color: "$gray700", marginBottom: "$2" },
});

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
  const isLastSlide = slideIndex === slides.length - 1;

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
                  <DialogBody
                    css={{
                      textAlign: "center",
                      "> * + *": { marginTop: "$6" },
                    }}
                  >
                    {item.description && (
                      <Text css={{ padding: "0 $6" }}>{item.description}</Text>
                    )}

                    {item.variant === "code" && (
                      <Box>
                        <Box
                          css={{
                            color: "$white",
                            textAlign: "right",
                          }}
                        >
                          <Box
                            css={{
                              display: "inline-block",
                              backgroundColor: "$primary",
                              borderTopLeftRadius: "$sm",
                              borderTopRightRadius: "$sm",
                              fontSize: "$xs",
                              padding: "$1 $2",
                              marginBottom: "-2px",
                            }}
                          >
                            {item.code.title}
                          </Box>
                        </Box>
                        <Box
                          css={{
                            border: "2px $gray300 solid",
                            borderRadius: "$md",
                            borderTopRightRadius: 0,
                            padding: "$1",
                          }}
                        >
                          <Box
                            as="ul"
                            css={{
                              fontFamily: "monospace",
                              textAlign: "left",
                              backgroundColor: "$gray900",
                              borderRadius: "$sm",
                              margin: 0,
                              padding: "$2",
                              paddingLeft: "$7",
                            }}
                          >
                            {item.code.lines.map((line, i) => (
                              <Box
                                as="li"
                                key={line}
                                css={{
                                  fontSize: "$sm",
                                  lineHeight: "$sm",
                                  color: "$white",
                                  "&::marker": {
                                    color: "$gray500",
                                    content: "'$ '",
                                  },
                                }}
                              >
                                {line}
                              </Box>
                            ))}
                          </Box>
                        </Box>
                      </Box>
                    )}

                    {item.variant === "icons" && (
                      <ul className={iconList()}>
                        {item.icons.map(({ icon, label }) => (
                          <li
                            key={[icon, label].join("-")}
                            className={iconListItem()}
                          >
                            <i aria-hidden={true} className="material-icons">
                              {icon}
                            </i>
                            {label}
                          </li>
                        ))}
                      </ul>
                    )}

                    {item.variant === "pipeline-diagram" && (
                      <PipelineDiagram css={{ padding: "0 $4" }} />
                    )}
                  </DialogBody>
                </m.div>
              )
          )}
        </AnimatePresence>
        <DialogFooter
          css={{
            paddingTop: "$8",
            paddingBottom: "$8",
          }}
        >
          <Box css={{ width: "100%", textAlign: "center" }}>
            <AnimatePresence initial={false}>
              <m.div
                key={isLastSlide ? "onboarding-end" : "onboarding-next"}
                initial={{ y: 50, opacity: 0, height: 0 }}
                animate={{ y: 0, opacity: 1, zIndex: 1, height: "auto" }}
                exit={{ y: 0, opacity: 0, zIndex: 0, height: 0 }}
                transition={{ type: "spring", damping: 15, stiffness: 150 }}
              >
                <MDCButtonReact
                  {...(isLastSlide
                    ? {
                        icon: "open_in_new",
                        label: "Open Quickstart Pipeline",
                        classNames: ["mdc-button--raised", "themed-secondary"],
                        onClick: () => onClose(),
                      }
                    : {
                        label: "Next",
                        classNames: ["mdc-button--outlined"],
                        onClick: () => cycleSlide(1),
                      })}
                />
              </m.div>
            </AnimatePresence>
          </Box>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
