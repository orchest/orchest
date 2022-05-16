import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { fetcher } from "@orchest/lib-utils";
import React from "react";

const Login: React.FC<{
  cloud: boolean;
  cloudUrl: string;
  documentationUrl: string;
  githubUrl: string;
  videosUrl: string;
  queryArgs: string;
}> = ({
  cloud,
  cloudUrl,
  documentationUrl,
  githubUrl,
  videosUrl,
  queryArgs,
}) => {
  // TODO: proper client-side validation
  const [loginFailure, setLoginFailure] = React.useState();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");

  const submitLogin = async (e: React.SyntheticEvent) => {
    e.preventDefault();

    let formData = new FormData();
    formData.append("username", username);
    formData.append("password", password);

    let queryString = queryArgs ? "?" + queryArgs : "";

    try {
      const response = await fetcher<{ redirect: string }>(
        `/login/submit${queryString}`,
        { method: "POST", body: formData }
      );

      if (response.redirect) {
        window.location.href = response.redirect;
      } else {
        throw { error: "Failed to redirect." };
      }
    } catch (error) {
      setLoginFailure(error.error);
    }
  };

  return (
    <div className="login-holder">
      {cloud && (
        <div className="cloud-login-helper">
          <div className="text-holder">
            <img src="image/logo-white.png" width="200px" />
            <h1>You have been added to a private Orchest instance</h1>
            <p>
              You can login with the username and password provided by the
              instance owner.
            </p>
            <p>
              To access the Orchest Cloud dashboard please{" "}
              <a href={cloudUrl}>login here</a>.
            </p>
          </div>
        </div>
      )}
      <div className="main-login-view">
        <div className="login-form">
          <div className="box">
            {cloud ? (
              <h2>
                Login to your
                <br />
                Orchest Instance
              </h2>
            ) : (
              <img src="image/logo.png" width="200px" className="logo" />
            )}
            <form method="post" onSubmit={submitLogin}>
              <Stack direction="column">
                <TextField
                  label="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  name="username"
                  margin="normal"
                  autoFocus
                />
                <TextField
                  label="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  name="password"
                  margin="normal"
                />
                <Button
                  type="submit"
                  variant="contained"
                  color="secondary"
                  sx={{ marginTop: 4 }}
                >
                  Login
                </Button>
                {loginFailure && (
                  <div className="error push-up">{loginFailure}</div>
                )}
              </Stack>
            </form>
          </div>
          <Box
            sx={{
              marginTop: (theme) => theme.spacing(3),
              width: "100%",
              textAlign: "center",
            }}
          >
            <Link
              color="secondary"
              target="_blank"
              href={documentationUrl}
              rel="noreferrer"
              sx={{ color: "grey.600" }}
            >
              Documentation
            </Link>
            <Box component="span"> - </Box>
            <Link
              color="secondary"
              target="_blank"
              href={githubUrl}
              rel="noreferrer"
              sx={{ color: "grey.600" }}
            >
              GitHub
            </Link>
            <Box component="span"> - </Box>
            <Link
              color="secondary"
              target="_blank"
              href={videosUrl}
              rel="noreferrer"
              sx={{ color: "grey.600" }}
            >
              Video tutorials
            </Link>
          </Box>
        </div>
      </div>
    </div>
  );
};

export default Login;
