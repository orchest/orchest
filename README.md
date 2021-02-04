<p align="center">
<a href="https://orchest.io">
  <img src="docs/source/img/logo.png" width="350px" />
</a>
</p>
<br/>

[Website](https://www.orchest.io) —
[Docs](https://orchest.readthedocs.io/en/stable/) —
[Quickstart](https://orchest.readthedocs.io/en/stable/getting_started/quickstart.html)

---

[![Join us on Slack](https://img.shields.io/badge/%20-Join%20us%20on%20Slack-blue?style=for-the-badge&logo=slack&labelColor=5c5c5c)](https://join.slack.com/t/orchest/shared_invite/zt-g6wooj3r-6XI8TCWJrXvUnXKdIKU_8w)

Orchest is a browser based IDE for Data Science. It integrates your favorite Data Science tools out of the box, so you don’t have to. The application is easy to use and can run on your laptop as well as on a large scale cloud cluster.

<p align="center">
<a target="_blank" href="https://www.youtube.com/watch?v=j0nySMu1-DQ"><img src="https://user-images.githubusercontent.com/1309307/100893895-27227e00-34bc-11eb-84d3-c26316453eee.gif" width="868px" alt="orchest-0.3.0-demo" /></a/></p>
<p align="center">
  <i>A preview of running pipelines in the pipeline editor of Orchest. Watch the <a target="_blank" href="https://www.youtube.com/watch?v=j0nySMu1-DQ">quickstart video</a> to learn more</a></i>.
 </p>

## Features

Orchest lets you:

- Visually construct pipelines.
- Write code using JupyterLab.
- Write code using any other editor of choice.
- Run any subset of a pipeline.
- Skip certain cells when executing a notebook top-to-bottom.
- Parametrize your data science pipelines to try out different modeling ideas.
- Integrate commonly used data-sources.
- Easily define your custom runtime environment.
- Version your pipelines through Git.

In our docs you can find a comprehensive
[quickstart](https://orchest.readthedocs.io/en/stable/getting_started/quickstart.html) tutorial!

## Installation

> **NOTE:** Orchest is in **alpha**.

For GPU support, language dependencies other than Python, and other installation methods, such as
building from source, refer to our [installation
docs](https://orchest.readthedocs.io/en/stable/getting_started/installation.html).

#### Requirements

- **Docker**

If you do not yet have Docker installed, please visit https://docs.docker.com/get-docker/.

#### Linux, macOS and Windows

Simply follow the steps below to install Orchest. For Windows, please read the note at the bottom first.

```bash
git clone https://github.com/orchest/orchest.git && cd orchest
./orchest install

# Verify the installation.
./orchest --help

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
[quickstart](https://orchest.readthedocs.io/en/stable/getting_started/quickstart.html) tutorial or
check out [pipelines](https://github.com/orchest/awesome-orchest-pipelines) made by your fellow
users.

## License

The software in this repository is licensed as follows:

- All content residing under the "orchest-sdk/" directory of this repository is licensed under the
  "Apache-2.0" license as defined in "orchest-sdk/LICENSE".
- Content outside of the above mentioned directory is available under the "AGPL-3.0" license.

## We love your feedback

We would love to hear what you think and potentially add features based on your ideas. Come chat
with us on [our Slack Channel](https://join.slack.com/t/orchest/shared_invite/zt-g6wooj3r-6XI8TCWJrXvUnXKdIKU_8w).

## Contributing

Contributions are more than welcome! Please see our
[contributor guides](https://orchest.readthedocs.io/en/stable/developer_guide/contributing.html)
for more details.

## Contributors
<!-- To get src for img: https://api.github.com/users/username -->
<a href="https://github.com/ricklamers"><img src="https://avatars2.githubusercontent.com/u/1309307?v=4" title="ricklamers" width="50" height="50"></a>
<a href="https://github.com/yannickperrenet"><img src="https://avatars0.githubusercontent.com/u/26223174?v=4" title="yannickperrenet" width="50" height="50"></a>
<a href="https://github.com/fruttasecca"><img src="https://avatars3.githubusercontent.com/u/19429509?v=4" title="fruttasecca" width="50" height="50"></a>
<a href="https://github.com/samkovaly"><img src="https://avatars2.githubusercontent.com/u/32314099?v=4" title="samkovaly" width="50" height="50"></a>
<a href="https://github.com/VivanVatsa"><img src="https://avatars0.githubusercontent.com/u/56357691?v=4" title="VivanVatsa" width="50" height="50"></a>
<a href="https://github.com/obulat"><img src="https://avatars1.githubusercontent.com/u/15233243?v=4" title="obulat" width="50" height="50"></a>
<a href="https://github.com/howie6879"><img src="https://avatars.githubusercontent.com/u/17047388?v=4" title="howie6879" width="50" height="50"></a>
<a href="https://github.com/FanaHOVA"><img src="https://avatars.githubusercontent.com/u/6490430?v=4" title="FanaHOVA" width="50" height="50"></a>
