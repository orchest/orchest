import { ICSSProp } from "@orchest/design-system";

export type TOnboardingDialogSlide = { title: string; description?: string } & (
  | { variant?: never; code?: never; icons?: never }
  | { variant: "pipeline-diagram" }
  | {
      variant: "icons";
      icons: { icon: string; label: string }[];
    }
  | {
      variant: "code";
      code: { title: string; lines: string[] };
    }
);

export type TOnboardingCarouselContext = {
  length: number;
  slideIndex: number;
  slideDirection: number;
  isLastSlide: boolean;
  cycleSlide: (direction: number) => void;
  setSlide: React.Dispatch<React.SetStateAction<[number, number]>>;
  isAnimating: boolean;
  setIsAnimating: React.Dispatch<React.SetStateAction<boolean>>;
};

export type TUseOnboardingCarouselStateProps = { length: number };
export type TUseOnboardingCarouselStateReturn = TOnboardingCarouselContext;
export type TOnboardingCarouselProps = TOnboardingCarouselContext;

export type TOnboardingCarouselIndicatorProps = ICSSProp & {
  className?: string;
};
