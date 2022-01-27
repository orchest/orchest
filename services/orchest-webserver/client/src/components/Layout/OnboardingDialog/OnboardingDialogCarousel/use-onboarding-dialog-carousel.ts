import { wrapNumber } from "@/utils/wrap-number";
import React from "react";
import { onboardingDialogCarouselSlides } from "./content";

export type Slide = { index: number; direction: number };

export const useOnboardingDialogCarousel = () => {
  const [isAnimating, setIsAnimating] = React.useState(false);
  const [slide, setSlide] = React.useState<Slide>({ index: 0, direction: 0 });

  const length = onboardingDialogCarouselSlides.length;

  const slideIndex = wrapNumber(0, length, slide.index);
  const isLastSlide = slideIndex === length - 1;

  const cycleSlide = (newSlideDirection: number) =>
    setSlide(({ index }) => {
      return {
        index: index + newSlideDirection,
        direction: newSlideDirection,
      };
    });

  return {
    length,
    slideIndex,
    slideDirection: slide.direction,
    isLastSlide,
    cycleSlide,
    setSlide,
    isAnimating,
    setIsAnimating,
  };
};
