import { DEFAULT_BASE_IMAGES } from "@/environment-edit-view/common";
import { CustomImage } from "@/types";
import create from "zustand";

type BaseImageStoreState = {
  environmentUuid?: string;
  selectedImage: CustomImage;
  customImage: CustomImage;
  setSelectedImage: (environmentUuid: string, value: CustomImage) => void;
  setCustomImage: (environmentUuid: string, value: CustomImage) => void;
  editCustomImage: (value: CustomImage) => void;
};

export const useBaseImageStore = create<BaseImageStoreState>((set) => ({
  selectedImage: DEFAULT_BASE_IMAGES[0],
  customImage: {
    base_image: "",
    language: "python",
    gpu_support: false,
  },
  setSelectedImage: (environmentUuid, value) => {
    set({ selectedImage: value, environmentUuid });
  },
  setCustomImage: (environmentUuid, value) => {
    set({ customImage: value, environmentUuid });
  },
  editCustomImage: (value) => {
    set({ selectedImage: value, customImage: value });
  },
}));
