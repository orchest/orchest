import Button, { buttonClasses } from "@mui/material/Button";
import { styled } from "@mui/material/styles";

const StyledButtonOutlined = styled(Button)({
  [`&.${buttonClasses.outlined}`]: {
    borderColor: (theme) => theme.borderColor,
  },
});

export default StyledButtonOutlined;
