import Box from "@mui/material/Box";
import { styled } from "@mui/material/styles";
import { AnimatePresence, m } from "framer-motion";
import React from "react";
import { Slide } from ".";

export const OnboardingDialogCarousel = ({ children, slideDirection }) => {
  return (
    <AnimatePresence initial={false} custom={slideDirection}>
      {children}
    </AnimatePresence>
  );
};

export const OnboardingDialogCarouselSlide = ({
  children,
  slideDirection,
  slideIndex,
  setIsAnimating,
  length,
  ...props
}) => {
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

const IndicatorList = styled("ul")({
  display: "flex",
  width: "100%",
  listStyleType: "none",
  justifyContent: "center",
});

const IndicatorListItem = styled("li")(({ theme }) => ({
  display: "block",
  "& + &": {
    marginLeft: theme.spacing(2),
  },
}));

const IndicatorButton = styled(Box)<{ isCurrent: boolean }>(
  ({ theme, isCurrent }) => ({
    appearance: "none",
    cursor: "pointer",
    width: theme.spacing(1),
    height: theme.spacing(1),
    backgroundColor: isCurrent
      ? theme.palette.grey[500]
      : theme.palette.grey[300],
    border: 0,
    borderRadius: "100%",
    transition: "0.2s ease",
    transitionProperty: "background-color, transform",
    "&:hover": {
      backgroundColor: theme.palette.grey[400],
      transform: "scale(1.25)",
    },
  })
);

const IndicatorLabel = styled("span")({
  clip: "rect(1px, 1px, 1px, 1px)",
  clipPath: "inset(50%)",
  height: "1px",
  width: "1px",
  margin: "-1px",
  overflow: "hidden",
  padding: 0,
  position: "absolute",
});

export const OnboardingDialogCarouselIndicator: React.FC<{
  length: number;
  slideIndex: number;
  setSlide: React.Dispatch<React.SetStateAction<Slide>>;
}> = ({ length, slideIndex, setSlide }) => {
  return (
    <IndicatorList role="list" data-test-id="onboarding-indicator-list">
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
                if (i !== slideIndex)
                  setSlide({ index: i, direction: slideIndex > i ? -1 : 1 });
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
