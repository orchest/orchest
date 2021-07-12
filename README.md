<p align="center">
<a href="https://orchest.io">
  <img src="docs/source/img/logo.png" width="350px" />
</a>
</p>

<p align="center">
<a href=https://orchest.readthedocs.io/en/stable>
    <img src="https://readthedocs.org/projects/orchest/badge/?version=latest&style=flat">
</a>
<a href=https://www.orchest.io/knowledge-base>
  <img src="https://img.shields.io/badge/Video tutorials-blue?style=flat&logo=airplayvideo&labelColor=5c5c5c">
</a>
<a href=https://orchest.readthedocs.io/en/stable/getting_started/quickstart.html>
  <img src="https://img.shields.io/badge/Quickstart-blue?style=flat&logo=readthedocs&labelColor=5c5c5c&color=fc0373">
</a>
<a href=https://join.slack.com/t/orchest/shared_invite/zt-g6wooj3r-6XI8TCWJrXvUnXKdIKU_8w>
  <img src="https://img.shields.io/badge/Slack-blue?style=flat&logo=slack&labelColor=5c5c5c">
</a>
</p>

## Hello, world! 👋

Orchest is a browser based IDE for Data Science. It integrates your favorite Data Science tools out
of the box, so you don’t have to. The application is easy to use and can run on your laptop as well
as on a large scale cloud cluster.

<p align="center">
<a target="_blank" href="https://www.youtube.com/watch?v=j0nySMu1-DQ"><img src="https://user-images.githubusercontent.com/1309307/111806797-a2c10300-88d2-11eb-9f21-bf1544f95b34.gif" width="868px" alt="orchest-0.3.0-demo" /></a/></p>
<p align="center">
  <i>A preview of creating pipelines in Orchest. Watch the <a target="_blank" href="https://www.youtube.com/watch?v=j0nySMu1-DQ">full video</a> to learn more</a></i>.
 </p>

Read the [docs](https://orchest.readthedocs.io/en/stable/); get the
[code](https://github.com/orchest/orchest#installation); ask us
[anything](https://join.slack.com/t/orchest/shared_invite/zt-g6wooj3r-6XI8TCWJrXvUnXKdIKU_8w)!

## Features

> For a complete list of Orchest's features, check out the
> [overview](https://orchest.readthedocs.io/en/stable/getting_started/overview.html) in our docs!

- Visually construct pipelines.
- Run any subset of a pipeline directly or on a cron-like schedule.
- Parametrize your data science pipelines to try out different modeling ideas.
- Easily define your custom runtime environment that runs on any machine.

#### Who should use Orchest?

- Data Scientists who want to rapidly prototype.
- Data Scientists who like to work in Notebooks.
- Data Scientists who are looking to create pipelines through a visual interface instead of YAML.

## Installation

> **NOTE:** Orchest is in **alpha**.

For GPU support, language dependencies other than Python, and other installation methods, such as
building from source, please refer to our [installation
docs](https://orchest.readthedocs.io/en/stable/getting_started/installation.html).

#### Requirements

- Docker ([Engine version](https://docs.docker.com/engine/install/) of `>= 20.10.7`; run `docker version` to check.)

If you do not yet have Docker installed, please visit https://docs.docker.com/get-docker/.

> **NOTE:** On Windows, Docker has to be configured to use WSL 2. Make sure to clone Orchest inside
> the Linux environment. For more info and installation steps for Docker with WSL 2 backend, please
> visit https://docs.docker.com/docker-for-windows/wsl/.

#### Linux, macOS and Windows

```bash
git clone https://github.com/orchest/orchest.git && cd orchest
./orchest install

# Verify the installation.
./orchest --help

# Start Orchest.
./orchest start
```

Now that you have installed Orchest, get started with our
[quickstart](https://orchest.readthedocs.io/en/stable/getting_started/quickstart.html) tutorial,
check out [pipelines](https://github.com/orchest/awesome-orchest-pipelines) made by your fellow
users, or have a look at our [knowledge base](https://www.orchest.io/knowledge-base) videos
explaining and showing some of Orchest's core concepts.

## License

The software in this repository is licensed as follows:

- All content residing under the "orchest-sdk/" directory of this repository is licensed under the
  "Apache-2.0" license as defined in "orchest-sdk/LICENSE".
- Content outside of the above mentioned directory is available under the "AGPL-3.0" license.

## Slack Community

Join our Slack to chat about Orchest, ask questions, and share tips.

[![Join us on Slack](https://img.shields.io/badge/%20-Join%20us%20on%20Slack-blue?style=for-the-badge&logo=slack&labelColor=5c5c5c)](https://join.slack.com/t/orchest/shared_invite/zt-g6wooj3r-6XI8TCWJrXvUnXKdIKU_8w)

## Contributing

Contributions are more than welcome! Please see our
[contributor guides](https://orchest.readthedocs.io/en/stable/developer_guide/contributing.html)
for more details.

Not sure where to start? [Book a free, no-pressure pairing session](mailto:rick@orchest.io?subject=Pairing%20session&body=I'd%20like%20to%20do%20a%20pairing%20session!) with one of our core contributors.

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
<a href="https://github.com/mitchglass97"><img src="https://avatars.githubusercontent.com/u/52224377?v=4" title="mitchglass97" width="50" height="50"></a>
<a href="https://github.com/joe-bell"><img src="https://avatars.githubusercontent.com/u/7349341?v=4" title="joe-bell" width="50" height="50"></a>
<a href="https://github.com/cceyda"><img src="https://avatars.githubusercontent.com/u/15624271?v=4" title="cceyda" width="50" height="50"></a>
<a href="https://github.com/MWeltevrede"><img src="https://avatars.githubusercontent.com/u/31962715?v=4" title="MWeltevrede" width="50" height="50"></a>
