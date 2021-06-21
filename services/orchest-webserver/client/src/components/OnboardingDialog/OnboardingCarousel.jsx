// @ts-check
import * as React from "react";
import { css } from "@orchest/design-system";
import { m, AnimatePresence } from "framer-motion";
import { wrapNumber } from "@/utils/wrap-number";

/**
 * @param {import('./types').TUseOnboardingCarouselStateProps} props
 * @returns {import('./types').TUseOnboardingCarouselStateReturn}
 */
export const useOnboardingCarouselState = ({ length }) => {
  const [[slideIndexState, slideDirection], setSlide] = React.useState([0, 0]);

  const slideIndex = wrapNumber(0, length, slideIndexState);
  const isLastSlide = slideIndex === length - 1;

  /** @param {number} newSlideDirection */
  const cycleSlide = (newSlideDirection) => {
    setSlide(([prevSlideIndex]) => [
      prevSlideIndex + newSlideDirection,
      newSlideDirection,
    ]);
  };

  return {
    length,
    slideIndex,
    slideDirection,
    isLastSlide,
    cycleSlide,
    setSlide,
  };
};

/** @type React.Context<import('./types').TOnboardingCarouselContext> */
const OnboardingCarouselContext = React.createContext(null);
const useOnboardingCarousel = () => React.useContext(OnboardingCarouselContext);

/**
 * Controlled Onboarding Carousel (state must be passed manually)
 *
 * @type React.FC<import('./types').TOnboardingCarouselProps>
 */
export const OnboardingCarousel = ({ children, ...props }) => (
  <OnboardingCarouselContext.Provider value={props}>
    {children}
  </OnboardingCarouselContext.Provider>
);

export const OnboardingCarouselSlides = ({ children }) => {
  const { slideDirection } = useOnboardingCarousel();

  return (
    <AnimatePresence initial={false} custom={slideDirection}>
      {children}
    </AnimatePresence>
  );
};

export const OnboardingCarouselSlide = ({ children, ...props }) => {
  const { slideDirection } = useOnboardingCarousel();
  return (
    <m.div
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
      {...props}
    >
      {children}
    </m.div>
  );
};

const indicatorList = css({
  include: "box",
  display: "flex",
  width: "100%",
  listStyleType: "none",
  justifyContent: "center",
});
const indicatorListItem = css({
  include: "box",
  content: "''",
  display: "block",
  width: "$space$2",
  height: "$space$2",
  backgroundColor: "$gray300",
  borderRadius: "$rounded",
  transition: "background-color 0.2s ease",
  "& + &": {
    marginLeft: "$2",
  },
  variants: {
    isCurrent: {
      true: {
        backgroundColor: "$gray500",
      },
    },
  },
});
const indicatorListItemLabel = css({ include: "screenReaderOnly" });

/**
 * @type React.FC<import('./types').TOnboardingCarouselIndicatorProps>
 */
export const OnboardingCarouselIndicator = ({ css, className }) => {
  const { length, slideIndex } = useOnboardingCarousel();

  return (
    <ul role="list" className={indicatorList({ css, className })}>
      {Array(length)
        .fill()
        .map((_, i) => (
          <li
            key={`indicatorListItem-${i}`}
            className={indicatorListItem({ isCurrent: i === slideIndex })}
            aria-current={i === slideIndex ? "step" : undefined}
          >
            <span className={indicatorListItemLabel()}>Slide {i + 1}</span>
          </li>
        ))}
    </ul>
  );
};
