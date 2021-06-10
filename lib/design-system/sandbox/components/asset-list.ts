import { styled } from "@orchest/design-system";

export const AssetList = styled("ul", {
  $$assetListGap: "$space$4",
  $$gridColorOverlay: "rgba(250,250,250, 0.95)",
  $$gridColorDark: "black",
  $$gridColorLight: "white",
  include: "box",
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  border: "2px solid $gray300",
  borderRadius: "$md",
  backgroundImage: [
    "linear-gradient(to right, $$gridColorOverlay, $$gridColorOverlay)",
    "linear-gradient(to right, $$gridColorDark 50%, $$gridColorLight 50%)",
    "linear-gradient(to bottom, $$gridColorDark 50%, $$gridColorLight 50%)",
  ].join(),
  backgroundBlendMode: "normal, difference, normal",
  backgroundSize: "2rem 2rem",
});

export const AssetListItem = styled("li", {
  listStyle: "none",
  margin: "$$assetListGap",
});
