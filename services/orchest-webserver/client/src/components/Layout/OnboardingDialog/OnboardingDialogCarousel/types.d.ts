import { ICSSProp } from "@orchest/design-system";

export type TOnboardingDialogCarouselSlide = { title: string } & (
  | { variant?: never; code?: never; icons?: never; description?: never }
  | { variant: "pipeline-diagram" }
  | {
      variant: "icons";
      description: string;
      icons: { icon: string; label: string }[];
    }
  | {
      variant: "code";
      description: string;
      code: { title: string; lines: string[] };
    }
  | ({
      variant: "end";
    } & Record<
      "description",
      { withQuickstart: string; withoutQuickstart: string }
    >)
);

export type TOnboardingDialogCarouselContext = {
  length: number;
  slideIndex: number;
  slideDirection: number;
  isLastSlide: boolean;
  cycleSlide: (direction: number) => void;
  setSlide: React.Dispatch<React.SetStateAction<[number, number]>>;
  isAnimating: boolean;
  setIsAnimating: React.Dispatch<React.SetStateAction<boolean>>;
};

export type TUseOnboardingDialogCarouselStateProps = { length: number };
export type TUseOnboardingDialogCarouselStateReturn = TOnboardingDialogCarouselContext;
export type TOnboardingDialogCarouselProps = TOnboardingDialogCarouselContext;

export type TOnboardingDialogCarouselIndicatorProps = ICSSProp & {
  className?: string;
};
