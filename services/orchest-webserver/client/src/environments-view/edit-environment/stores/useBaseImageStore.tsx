import { DEFAULT_BASE_IMAGES } from "@/environment-edit-view/common";
import { CustomImage } from "@/types";
import create from "zustand";

type BaseImageStoreState = {
  selectedImage: CustomImage;
  customImage: CustomImage;
  setSelectedImage: (value: CustomImage) => void;
  setCustomImage: (value: CustomImage) => void;
  editCustomImage: (value: CustomImage) => void;
};

export const useBaseImageStore = create<BaseImageStoreState>((set) => ({
  selectedImage: DEFAULT_BASE_IMAGES[0],
  customImage: {
    base_image: "",
    language: "python",
    gpu_support: false,
  },
  setSelectedImage: (value) => {
    set({ selectedImage: value });
  },
  setCustomImage: (value) => {
    set({ customImage: value });
  },
  editCustomImage: (value) => {
    set({ selectedImage: value, customImage: value });
  },
}));
