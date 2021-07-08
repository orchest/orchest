import * as React from "react";
import { css, ICSSProp } from "@orchest/design-system";
import { m, AnimatePresence } from "framer-motion";
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
  const { slideDirection, setIsAnimating } = useOnboardingDialogCarousel();
  return (
    <m.div
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

interface IOnboardingDialogCarouselIndicatorProps
  extends React.HTMLAttributes<HTMLUListElement>,
    ICSSProp {}

export const OnboardingDialogCarouselIndicator: React.FC<IOnboardingDialogCarouselIndicatorProps> = ({
  css,
  className,
}) => {
  const { length, slideIndex, setSlide } = useOnboardingDialogCarousel();

  return (
    <ul role="list" className={indicatorList({ css, className })}>
      {Array(length)
        .fill(0)
        .map((_, i) => (
          <li
            key={`indicatorListItem-${i}`}
            className={indicatorListItem()}
            aria-current={i === slideIndex ? "step" : undefined}
          >
            <button
              className={indicatorButton({ isCurrent: i === slideIndex })}
              onClick={() => {
                if (i !== slideIndex) setSlide([i, slideIndex > i ? -1 : 1]);
              }}
            >
              <span className={indicatorLabel()}>Slide {i + 1}</span>
            </button>
          </li>
        ))}
    </ul>
  );
};
