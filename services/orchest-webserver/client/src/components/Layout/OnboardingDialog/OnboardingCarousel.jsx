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
  const [isAnimating, setIsAnimating] = React.useState(false);
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
    isAnimating,
    setIsAnimating,
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
  const { slideDirection, setIsAnimating } = useOnboardingCarousel();
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
      onAnimationComplete={() => setIsAnimating(false)}
      onAnimationStart={() => setIsAnimating(true)}
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
  display: "block",
  "& + &": {
    marginLeft: "$2",
  },
});
const indicatorButton = css({
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
const indicatorLabel = css({ include: "screenReaderOnly" });

/**
 * @type React.FC<import('./types').TOnboardingCarouselIndicatorProps>
 */
export const OnboardingCarouselIndicator = ({ css, className }) => {
  const { length, slideIndex, setSlide } = useOnboardingCarousel();

  return (
    <ul role="list" className={indicatorList({ css, className })}>
      {Array(length)
        .fill()
        .map((_, i) => (
          <li
            key={`indicatorListItem-${i}`}
            className={indicatorListItem()}
            aria-current={i === slideIndex ? "step" : undefined}
          >
            <button
              className={indicatorButton({ isCurrent: i === slideIndex })}
              onClick={() => {
                if (i !== slideIndex)
                  setSlide(([prevSlideIndex, _]) => [
                    i,
                    prevSlideIndex > i ? -1 : 1,
                  ]);
              }}
            >
              <span className={indicatorLabel()}>Slide {i + 1}</span>
            </button>
          </li>
        ))}
    </ul>
  );
};
