import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import React from "react";

const ContributeCard: React.FC<{ style?: React.CSSProperties }> = ({
  style = {},
}) => {
  const onClick = () => {
    window.open(
      "https://github.com/orchest/orchest-examples",
      "_blank",
      "noopener,noreferrer"
    );
  };
  return (
    <Card
      style={style}
      sx={{
        backgroundColor: (theme) => theme.palette.primary.main,
        color: (theme) => theme.palette.common.white,
        width: "28rem",
        height: "20rem",
        display: "flex",
        flexDirection: "column",
        padding: (theme) => theme.spacing(2),
        marginTop: (theme) => theme.spacing(4),
        marginRight: (theme) => theme.spacing(4),
      }}
    >
      <CardContent sx={{ flex: 1 }}>
        <Typography
          variant="h5"
          component="h3"
          sx={{
            fontWeight: (theme) => theme.typography.fontWeightBold,
            marginBottom: (theme) => theme.spacing(2),
            width: "60%",
          }}
        >
          Contribute your own example!
        </Typography>
        <Typography sx={{ marginBottom: (theme) => theme.spacing(1) }}>
          Help others get started by sharing your Orchest pipelines. The best
          pipelines will get featured.
        </Typography>
        <Typography sx={{ marginBottom: (theme) => theme.spacing(1) }}>
          Start sharing simply by uploading your project to GitHub.
        </Typography>
      </CardContent>
      <CardActions sx={{ justifyContent: "flex-end" }}>
        <Button
          variant="contained"
          startIcon={<OpenInNewIcon />}
          onClick={onClick}
          sx={{
            backgroundColor: (theme) => theme.palette.common.white,
            ":hover": {
              backgroundColor: (theme) => theme.palette.common.white,
              color: (theme) => theme.palette.grey[600],
            },
            color: (theme) => theme.palette.grey[800],
          }}
        >
          SUBMIT EXAMPLE
        </Button>
      </CardActions>
    </Card>
  );
};

export { ContributeCard };
