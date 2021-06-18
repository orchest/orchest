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
  DIALOG_ANIMATION_DURATION,
  IconButton,
  IconCrossSolid,
  Text,
} from "@orchest/design-system";
import { useProjects } from "@/hooks/projects";
import { useOrchest } from "@/hooks/orchest";
import { useLocalStorage } from "@/hooks/local-storage";
import { wrapNumber } from "@/utils/wrap-number";
import PipelineView from "@/views/PipelineView";
import { PipelineDiagram } from "./assets";
import { slides } from "./content";

const codeHeader = css({ include: "box", textAlign: "right" });
const codeHeading = css({
  include: "box",
  display: "inline-block",
  padding: "$1 $2",
  marginBottom: "-2px",
  fontSize: "$xs",
  borderTopLeftRadius: "$sm",
  borderTopRightRadius: "$sm",
  backgroundColor: "$primary",
  color: "$white",
});
const codeWindow = css({
  include: "box",
  border: "2px $gray300 solid",
  borderRadius: "$md",
  borderTopRightRadius: 0,
  padding: "$1",
});
const codeList = css({
  include: "box",
  fontFamily: "monospace",
  textAlign: "left",
  backgroundColor: "$gray900",
  borderRadius: "$sm",
  margin: 0,
  padding: "$2",
  paddingLeft: "$7",
});
const codeListItem = css({
  include: "box",
  fontSize: "$sm",
  lineHeight: "$sm",
  color: "$white",
  "&::marker": {
    color: "$gray500",
    content: "'$ '",
  },
});

const iconList = css({
  include: "box",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(0, 1fr))",
  gridAutoFlow: "column",
});
const iconListItem = css({
  include: "box",
  display: "flex",
  flexDirection: "column",
  fontSize: "$sm",
  "> i": { fontSize: "2rem", color: "$gray700", marginBottom: "$2" },
});

/** @param {import('@/hooks/projects/types').TUseProjectsOptions} [options] */
const useQuickstart = ({ shouldFetch }) => {
  const { data } = useProjects({ shouldFetch });

  const project = data?.find((project) => project.path === "quickstart");

  return typeof project === "undefined"
    ? undefined
    : {
        project_uuid: project.uuid,
        pipeline_uuid: "0915b350-b929-4cbd-b0d4-763cac0bb69f",
      };
};

/** @type React.FC<{}> */
export const OnboardingDialog = () => {
  const { orchest } = window;

  const {
    state: { config },
  } = useOrchest();

  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [shouldFetch, setShouldFetch] = React.useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useLocalStorage(
    "onboarding_completed",
    false
  );
  const [[slideIndexState, slideDirection], setSlide] = React.useState([0, 0]);

  const slideIndex = wrapNumber(0, slides.length, slideIndexState);
  const isLastSlide = slideIndex === slides.length - 1;

  const quickstart = useQuickstart({ shouldFetch });
  const hasQuickstart = typeof quickstart !== "undefined";

  /** @param {number} newSlideDirection */
  const cycleSlide = (newSlideDirection) => {
    setSlide(([prevSlideIndex]) => [
      prevSlideIndex + newSlideDirection,
      newSlideDirection,
    ]);
  };

  const onOpen = () => {
    setIsDialogOpen(true);
    setShouldFetch(true);
  };
  /** @param {{loadQuickstart?: boolean}} [options] */
  const onClose = ({ loadQuickstart } = {}) => {
    setIsDialogOpen(false);
    setHasCompletedOnboarding(true);
    // Wait for Dialog transition to finish before resetting position.
    // This way we avoid showing the slides animating back to the start.
    setTimeout(() => {
      setShouldFetch(false);
      setSlide([0, 0]);
      loadQuickstart &&
        orchest.loadView(PipelineView, {
          queryArgs: quickstart,
        });
    }, DIALOG_ANIMATION_DURATION.OUT);
  };

  React.useEffect(() => {
    if (config.CLOUD && !hasCompletedOnboarding) onOpen();
  }, []);

  return (
    <Dialog
      open={isDialogOpen}
      onOpenChange={(open) => (open ? onOpen() : onClose())}
    >
      <DialogContent size="md" css={{ paddingTop: "$10", overflow: "hidden" }}>
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
                  variants={{
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
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    type: "tween",
                    duration: 0.3,
                    ease: "easeInOut",
                  }}
                >
                  <DialogHeader css={{ justifyContent: "center" }}>
                    <DialogTitle>{item.title}</DialogTitle>
                  </DialogHeader>
                  <DialogBody
                    css={{
                      margin: "0 auto",
                      maxWidth: "$sm",
                      textAlign: "center",
                      "> * + *": { marginTop: "$6" },
                    }}
                  >
                    {item.description && (
                      <Text css={{ margin: "0 auto", maxWidth: "$xs" }}>
                        {item.description}
                      </Text>
                    )}

                    {item.variant === "code" && (
                      <article>
                        <header className={codeHeader()}>
                          <h1 className={codeHeading()}>{item.code.title}</h1>
                        </header>
                        <div className={codeWindow()}>
                          <ul className={codeList()}>
                            {item.code.lines.map((line, i) => (
                              <li key={line} className={codeListItem()}>
                                {line}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </article>
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
                      <PipelineDiagram css={{ padding: "$2" }} />
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
                        icon: hasQuickstart && "open_in_new",
                        label: hasQuickstart
                          ? "Open Quickstart Pipeline"
                          : "Get Started",
                        classNames: ["mdc-button--raised", "themed-secondary"],
                        onClick: () =>
                          onClose({ loadQuickstart: hasQuickstart }),
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
