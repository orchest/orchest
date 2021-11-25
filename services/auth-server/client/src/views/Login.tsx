import Button from "@mui/material/Button";
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
  const [loginFailure, setLoginFailure] = React.useState();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");

  const submitLogin = async (e) => {
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
      }
    } catch (error) {
      setLoginFailure(error.body.error);
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
              <TextField
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                name="username"
              />
              <br />
              <TextField
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                name="password"
              />
              <br />
              <Button type="submit" variant="contained" color="secondary">
                Login
              </Button>
              {loginFailure && (
                <div className="error push-up">{loginFailure}</div>
              )}
            </form>
          </div>
          <div className="utility-links">
            <a target="_blank" href={documentationUrl} rel="noreferrer">
              Documentation
            </a>
            <span> - </span>
            <a target="_blank" href={githubUrl} rel="noreferrer">
              GitHub
            </a>
            <span> - </span>
            <a target="_blank" href={videosUrl} rel="noreferrer">
              Video tutorials
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
