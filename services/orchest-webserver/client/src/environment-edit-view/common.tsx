import { CustomImage, Language } from "@/types";

export const LANGUAGE_MAP: Record<Language, string> = {
  python: "Python",
  r: "R",
  julia: "Julia",
};

// Related to the analytics.py module, "environment_build_start" event,
// which checks for the base image to start with "orchest/".
export const DEFAULT_BASE_IMAGES: CustomImage[] = [
  {
    base_image: "orchest/base-kernel-py",
    language: "python",
    gpu_support: false,
  },
  {
    base_image: "orchest/base-kernel-py-gpu",
    language: "python",
    gpu_support: true,
  },
  {
    base_image: "orchest/base-kernel-r",
    language: "r",
    gpu_support: false,
  },
  {
    base_image: "orchest/base-kernel-julia",
    language: "julia",
    gpu_support: false,
  },
];
