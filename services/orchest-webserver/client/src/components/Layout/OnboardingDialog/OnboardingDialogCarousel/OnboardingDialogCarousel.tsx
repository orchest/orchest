import { ICSSProp, styled } from "@orchest/design-system";
import { AnimatePresence, m } from "framer-motion";
import * as React from "react";
import { useOnboardingDialogCarousel } from "./use-onboarding-dialog-carousel";

export const OnboardingDialogCarousel = ({ children }) => {
  const { slideDirection } = useOnboardingDialogCarousel();

  return (
    <AnimatePresence initial={false} custom={slideDirection}>
      {children}
    </AnimatePresence>
  );
};

export const OnboardingDialogCarouselSlide = ({ children, ...props }) => {
  const {
    slideDirection,
    slideIndex,
    setIsAnimating,
    length,
  } = useOnboardingDialogCarousel();
  return (
    <m.div
      data-test-id="onboarding-slide"
      data-test-index={slideIndex}
      data-test-length={length}
      custom={slideDirection}
      variants={{
        enter: (slideDirection: number) => {
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
        exit: (slideDirection: number) => {
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
      onAnimationComplete={() => setIsAnimating(false)}
      onAnimationStart={() => setIsAnimating(true)}
      {...props}
    >
      {children}
    </m.div>
  );
};

const IndicatorList = styled("ul", {
  include: "box",
  display: "flex",
  width: "100%",
  listStyleType: "none",
  justifyContent: "center",
});
const IndicatorListItem = styled("li", {
  include: "box",
  display: "block",
  "& + &": {
    marginLeft: "$2",
  },
});
const IndicatorButton = styled("button", {
  include: "box",
  appearance: "none",
  width: "$space$2",
  height: "$space$2",
  backgroundColor: "$gray300",
  border: 0,
  borderRadius: "$rounded",
  transition: "0.2s ease",
  transitionProperty: "background-color, transform",
  "&:hover": {
    backgroundColor: "$gray400",
    transform: "scale(1.25)",
  },
  variants: {
    isCurrent: {
      true: {
        backgroundColor: "$gray500",
      },
    },
  },
});
const IndicatorLabel = styled("span", { include: "screenReaderOnly" });

interface IOnboardingDialogCarouselIndicatorProps
  extends React.HTMLAttributes<HTMLUListElement>,
    ICSSProp {}

export const OnboardingDialogCarouselIndicator: React.FC<IOnboardingDialogCarouselIndicatorProps> = (
  props
) => {
  const { length, slideIndex, setSlide } = useOnboardingDialogCarousel();

  return (
    <IndicatorList
      role="list"
      data-test-id="onboarding-indicator-list"
      {...props}
    >
      {Array(length)
        .fill(0)
        .map((_, i) => (
          <IndicatorListItem
            key={`indicatorListItem-${i}`}
            aria-current={i === slideIndex ? "step" : undefined}
            data-test-id="onboarding-indicator-list-item"
          >
            <IndicatorButton
              isCurrent={i === slideIndex}
              onClick={() => {
                if (i !== slideIndex) setSlide([i, slideIndex > i ? -1 : 1]);
              }}
              data-test-id="onboarding-indicator-button"
            >
              <IndicatorLabel>Slide {i + 1}</IndicatorLabel>
            </IndicatorButton>
          </IndicatorListItem>
        ))}
    </IndicatorList>
  );
};
