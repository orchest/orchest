import Button, { buttonClasses } from "@mui/material/Button";
import { styled } from "@mui/material/styles";

const StyledButtonOutlined = styled(Button)({
  [`&.${buttonClasses.outlined}`]: {
    borderColor: "rgba(0, 0, 0, 0.12)",
  },
});

export default StyledButtonOutlined;
