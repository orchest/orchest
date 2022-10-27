<p align="center">
<a href="https://orchest.io">
  <img src="docs/source/img/logo.png" width="350px" />
</a>
</p>

<p align="center">
<a href=https://orchest.io><img src="https://img.shields.io/badge/Website-violet?style=flat&logo=webflow&labelColor=5c5c5c"></a>
<a href=https://docs.orchest.io/en/stable><img src="https://readthedocs.org/projects/orchest/badge/?version=stable&style=flat"></a>
<a href=https://www.orchest.io/video-tutorials><img src="https://img.shields.io/badge/Video tutorials-blue?style=flat&logo=airplayvideo&labelColor=5c5c5c"></a>
<a href=https://docs.orchest.io/en/stable/getting_started/quickstart.html><img src="https://img.shields.io/badge/Quickstart-blue?style=flat&logo=readthedocs&labelColor=5c5c5c&color=fc0373"></a>
<a href=https://www.orchest.io/#orchest-cloud><img src="https://img.shields.io/badge/Orchest%20Cloud-blue?style=flat&logo=iCloud&labelColor=5c5c5c&logoColor=white"></a>
<a href=https://join.slack.com/t/orchest/shared_invite/zt-g6wooj3r-6XI8TCWJrXvUnXKdIKU_8w><img src="https://img.shields.io/badge/Slack-violet?style=flat&logo=slack&labelColor=5c5c5c"></a>
</p>

## Build data pipelines, the easy way 🙌

No frameworks. No YAML. Just write your data processing code directly in **Python**, **R** or
**Julia**.

<p align="center">
  <img width="100%" src="https://user-images.githubusercontent.com/1309307/191785568-ce4857c3-e71f-4b71-84ce-dfa5d65a98f9.gif">
</p>

<p align="center">
  <i>💡 Watch the <a target="_blank" href="https://vimeo.com/589879082">full narrated video</a> to learn more about building data pipelines in Orchest.</i>
 </p>

> **Note**: Orchest is in **beta**.

## Features

- **Visually construct pipelines** through our user-friendly UI
- **Code in Notebooks** and scripts
  ([quickstart](https://docs.orchest.io/en/stable/getting_started/quickstart.html))
- Run any subset of a pipelines directly or periodically
  ([jobs](https://docs.orchest.io/en/stable/fundamentals/jobs.html))
- Easily define your dependencies to run on **any machine**
  ([environments](https://docs.orchest.io/en/stable/fundamentals/environments.html))
- Spin up services whose lifetime spans across the entire pipeline run
  ([services](https://docs.orchest.io/en/stable/fundamentals/services.html))
- Version your projects using git
  ([projects](https://docs.orchest.io/en/stable/fundamentals/projects.html))

**When to use Orchest?** Read it in the
[docs](https://docs.orchest.io/en/stable/getting_started/when_to_use_orchest.html).

👉 Get started with our
[quickstart](https://docs.orchest.io/en/stable/getting_started/quickstart.html) tutorial or have a look at our [video tutorials](https://www.orchest.io/video-tutorials) explaining some of Orchest's core concepts.

## Roadmap

Missing a feature? Have a look at [our public roadmap](https://github.com/orgs/orchest/projects/1)
to see what the team is working on in the short and medium term.
Still missing it? Please [let us know by opening an issue](https://github.com/orchest/orchest/issues/new/choose)!

## Examples

Get started with an example project:

- [Train and compare 3 regression models](https://github.com/orchest/quickstart)
- [Connecting to an external database using SQLAlchemy](https://github.com/astrojuanlu/orchest-sqlalchemy)
- [Run dbt in Orchest for a dbt + Python transform pipeline](https://github.com/ricklamers/orchest-dbt)
- [Use PySpark in Orchest](https://github.com/ricklamers/orchest-hello-spark)

👉 Check out the full list of [example projects](https://github.com/orchest/orchest-examples).

## Installation

Want to skip the installation and jump right in? Then try out our managed service by clicking:

[![Open in Orchest](https://github.com/orchest/orchest-examples/raw/main/imgs/open_in_orchest_large.svg)](https://cloud.orchest.io/)

For `macOS` and `Linux` we provide an automated convience script to install Orchest on
[minikube](https://minikube.sigs.k8s.io/docs/). Run it with:

```sh
curl -fsSL https://get.orchest.io > convenience_install.sh
bash convenience_install.sh
```

👉 For detailed instructions on how to deploy a self-hosted version, check out our [installation
docs](https://docs.orchest.io/en/stable/getting_started/installation.html).

## License

The software in this repository is licensed as follows:

- All content residing under the ` orchest-sdk/` and `orchest-cli/` directories of this repository
  are licensed under the `Apache-2.0` license as defined in `orchest-sdk/LICENSE` and
  `orchest-cli/LICENSE` respectively.
- Content outside of the above mentioned directories is available under the `AGPL-3.0` license.

## Slack Community

Join our Slack to chat about Orchest, ask questions, and share tips.

[![Join us on Slack](https://img.shields.io/badge/%20-Join%20us%20on%20Slack-blue?style=for-the-badge&logo=slack&labelColor=5c5c5c)](https://join.slack.com/t/orchest/shared_invite/zt-g6wooj3r-6XI8TCWJrXvUnXKdIKU_8w)

## Contributing

Contributions are more than welcome! Please see our [contributor
guides](https://docs.orchest.io/en/stable/development/contributing.html) for more details.

Alternatively, you can submit your pipeline to the curated list of [Orchest
examples](https://github.com/orchest/orchest-examples) that are automatically loaded in every
Orchest deployment! 🔥

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
<a href="https://github.com/kingabzpro"><img src="https://avatars.githubusercontent.com/u/36753484?v=4" title="Abid" width="50" height="50"></a>
<a href="https://github.com/iannbing"><img src="https://avatars.githubusercontent.com/u/627607?v=4" title="iannbing" width="50" height="50"></a>
<a href="https://github.com/andtheWings"><img src="https://avatars.githubusercontent.com/u/5892089?v=4" title="andtheWings" width="50" height="50"></a>
<a href="https://github.com/jacobodeharo"><img src="https://avatars.githubusercontent.com/jacobodeharo?v=4" title="jacobodeharo" width="50" height="50"></a>
<a href="https://github.com/nhaghighat"><img src="https://avatars.githubusercontent.com/u/3792293?v=4" title="nhaghighat" width="50" height="50"></a>
<a href="https://github.com/porcupineyhairs"><img src="https://avatars.githubusercontent.com/u/61983466?v=4" title="porcupineyhairs" width="50" height="50"></a>
<a href="https://github.com/ncspost"><img src="https://avatars.githubusercontent.com/ncspost?v=4" title="ncspost" width="50" height="50"></a>
<a href="https://github.com/cavriends"><img src="https://avatars.githubusercontent.com/u/4497501?v=4" title="cavriends" width="50" height="50"></a>
<a href="https://github.com/astrojuanlu"><img src="https://avatars.githubusercontent.com/u/316517?v=4" title="astrojuanlu" width="50" height="50"></a>
<a href="https://github.com/mausworks"><img src="https://avatars.githubusercontent.com/u/8259221?v=4" title="mausworks" width="50" height="50"></a>
<a href="https://github.com/jerdna-regeiz"><img src="https://avatars.githubusercontent.com/u/7195718?v=4" title="jerdna-regeiz" width="50" height="50"></a>
<a href="https://github.com/sbarrios93"><img src="https://avatars.githubusercontent.com/u/19554889?v=4" title="sbarrios93" width="50" height="50"></a>
<a href="https://github.com/cacrespo"><img src="https://avatars.githubusercontent.com/u/10950697?v=4" title="cacrespo" width="50" height="50"></a>
