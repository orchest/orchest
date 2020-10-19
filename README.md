<img src='docs/source/img/logo.png' width="300px" />
<br/>

[Website](https://www.orchest.io) — 
[Docs](https://orchest.readthedocs.io/en/latest/) — 
[Quickstart](https://orchest.readthedocs.io/en/latest/quickstart.html) — 
[Slack](https://join.slack.com/t/orchest/shared_invite/zt-g6wooj3r-6XI8TCWJrXvUnXKdIKU_8w)

-----
<img alt="Version badge 0.2.1-alpha"
src="https://img.shields.io/badge/version-0.2.1--alpha-blue" />

Orchest is a web based data science tool that works on top of your filesystem allowing you to use
your editor of choice. With Orchest you get to focus on visually building and iterating on your
pipeline ideas. Under the hood Orchest runs a collection of containers to provide a scalable
platform that can run on your laptop as well as on a large scale cloud cluster.

Orchest lets you
* Interactively build data science pipelines through its visual interface.
* Automatically run your pipelines in parallel.
* Develop your code in your favorite editor. Everything is filesystem based.
* Tag the notebooks cells you want to skip when running a pipeline. Perfect for prototyping as you
  do not have to maintain a perfectly clean notebook.
* Run experiments by parametrizing your pipeline. Easily try out all of your modeling ideas.


## Table of contents
- [Installation](#installation)
- [Preview](#preview)
- [License](#license)
- [Contributing](#contributing)
- [We love your feedback](#we-love-your-feedback)


## Installation
#### Requirements
* Docker (tested on 19.03.9)

If you do not yet have Docker installed, please visit https://docs.docker.com/get-docker/.

#### Linux, macOS and Windows
Simply follow the steps below to install Orchest. For Windows, please read the note at the bottom first.
```bash
git clone https://github.com/orchest/orchest.git
cd orchest

# The start command will automatically install Orchest if it is not
# yet installed. After installation is finished Orchest is started
./orchest.sh start
```

**Note!** On Windows, Docker has to be configured to use WSL 2. Make sure to clone Orchest inside
the Linux environment. For more info about Docker with WSL 2, please visit
https://docs.docker.com/docker-for-windows/wsl/.


## Preview
In our docs you can find a comprehensive
[quickstart](https://orchest.readthedocs.io/en/latest/quickstart.html) tutorial!

![clip-3-cropped](https://user-images.githubusercontent.com/1309307/82610401-95f25680-9bbe-11ea-9de3-b4dc44a1e01b.gif)
*A preview of running pipelines in the pipeline editor of Orchest*


## License
The software in this repository is licensed as follows:
* All content residing under the "orchest-sdk/" directory of this repository is licensed under the
    "Apache-2.0" license as defined in "orchest-sdk/LICENSE".
* Content outside of the above mentioned directory is available under the "AGPL-3.0" license.


## Contributing
Contributions are more than welcome! Please see our 
[contributer guides](https://orchest.readthedocs.io/en/latest/development/contributer_guides.html)
for more details.


## We love your feedback
We would love to hear what you think and potentially add features based on your ideas. Come chat
with us on [Slack](https://join.slack.com/t/orchest/shared_invite/zt-g6wooj3r-6XI8TCWJrXvUnXKdIKU_8w).
