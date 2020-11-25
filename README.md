<p align="center">
<a href="https://orchest.io">
  <img src="docs/source/img/logo.png" width="300px" />
</a>
</p>
<br/>

[Website](https://www.orchest.io) —
[Docs](https://orchest.readthedocs.io/en/latest/) —
[Quickstart](https://orchest.readthedocs.io/en/latest/getting_started/quickstart.html)

---

[![Join us on Slack](https://img.shields.io/badge/%20-Join%20us%20on%20Slack-blue?style=for-the-badge&logo=slack&labelColor=5c5c5c)](https://join.slack.com/t/orchest/shared_invite/zt-g6wooj3r-6XI8TCWJrXvUnXKdIKU_8w)

Orchest is a web based tool for creating data science pipelines. Under the hood Orchest runs a
collection of containers to provide a scalable platform that can run on your laptop as well as on a
large scale cloud cluster.

Orchest lets you:

- Visually construct pipelines.
- Write code using JupyterLab.
- Write code using any other editor of choice.
- Run any subset of a pipeline.
- Skip certain cells when executing a notebook top-to-bottom.
- Parametrize your data science pipelines to experiment with different modeling ideas.
- Integrate commonly used data sources.
- Easily define your custom runtime environment.
- Version your pipelines through git.

## Preview

In our docs you can find a comprehensive
[quickstart](https://orchest.readthedocs.io/en/latest/getting_started/quickstart.html) tutorial!

![clip-3-cropped](https://user-images.githubusercontent.com/1309307/82610401-95f25680-9bbe-11ea-9de3-b4dc44a1e01b.gif)
_A preview of running pipelines in the pipeline editor of Orchest._

## Installation

> **NOTE:** Orchest is in alpha.

For GPU support and other installation methods, such as building from source, refer to our
[installation docs](https://orchest.readthedocs.io/en/latest/getting_started/installation.html).

#### Requirements

- Docker

If you do not yet have Docker installed, please visit https://docs.docker.com/get-docker/.

#### Linux, macOS and Windows

Simply follow the steps below to install Orchest. For Windows, please read the note at the bottom first.

```bash
git clone https://github.com/orchest/orchest.git
cd orchest

# The update command is used both for installation and updating to
# the newest release.
./orchest update

# Verify the installation. This should print the help message.
./orchest

```

> **NOTE:** On Windows, Docker has to be configured to use WSL 2. Make sure to clone Orchest inside
> the Linux environment. For more info and installation steps for Docker with WSL 2 backend, please
> visit https://docs.docker.com/docker-for-windows/wsl/.

## Starting Orchest

```bash
# Make sure to be in the cloned "orchest" directory.
./orchest start
```

Get started with our
[quickstart](https://orchest.readthedocs.io/en/latest/getting_started/quickstart.html) tutorial.

## License

The software in this repository is licensed as follows:

- All content residing under the "orchest-sdk/" directory of this repository is licensed under the
  "Apache-2.0" license as defined in "orchest-sdk/LICENSE".
- Content outside of the above mentioned directory is available under the "AGPL-3.0" license.

## Contributing

Contributions are more than welcome! Please see our
[contributer guides](https://orchest.readthedocs.io/en/latest/developer_guide/contributing.html)
for more details.

## We love your feedback

We would love to hear what you think and potentially add features based on your ideas. Come chat
with us on [our Slack](https://join.slack.com/t/orchest/shared_invite/zt-g6wooj3r-6XI8TCWJrXvUnXKdIKU_8w).
