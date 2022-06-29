window.document.addEventListener("DOMContentLoaded", function () {
  const CONTAINER_CLASS = ".installer-container";

  let installerData = {
    Cloud: {
      GKE: {
        instructions: ``,
      },
      EKS: {
        instructions: ``,
      },
    },
    Linux: {
      minikube: {
        instructions: `<p>After <a href="https://minikube.sigs.k8s.io/docs/start/">minikube</a> installation. then create a minikube cluster and configure ingress</p>
        <div class="highlight">
          <pre>minikube start --cpus 4 --addons ingress</pre>
        </div>
        <p>Then orchest can be installed via orchest-cli</p>
          <div class="highlight">
<pre>
pip install --upgrade orchest-cli 
orchest install
</pre>
        </div>
        <p>Now the cluster can be reached on the IP returned by:</p>
        <div class="highlight">
          <pre>minikube ip</pre>        
        </div>
        <div class="admonition tip">
          <p class="admonition-title">Tip</p>
          <p>👉 We provide an automated convenience script for a complete minikube deployment. Taking care of installing <code class="docutils literal notranslate"><span class="pre">minikube</span></code>, installing the <code class="docutils literal notranslate"><span class="pre">orchest-cli</span></code> and installing Orchest, run it with:</p>
          <div class="highlight">
          <pre>curl -fsSL https://get.orchest.io > convenience_install.sh \\
&& bash convenience_install.sh</pre>
          </div>
        </div>`,
      },
      microK8s: {
        instructions: `After <a href="https://microk8s.io/#install-microk8s">microk8s</a> installation. following addons have to be enabled</p>
        <div class="highlight">
<pre>
microk8s enable hostpath-storage \\
&& microk8s enable dns \\
&& microk8s enable ingress
</pre>
        </div>
        <p>Then orchest can be installed via orchest-cli</p>
        <div class="highlight">
<pre>
pip install --upgrade orchest-cli 
orchest install --socket-path=/var/snap/microk8s/common/run/containerd.sock
</pre>
        </div>`,
      },
    },
    macOS: {
      minikube: {
        instructions: `<p>After <a href="https://minikube.sigs.k8s.io/docs/start/">minikube</a> installation. then create a minikube cluster and configure ingress</p>
        <div class="highlight">
          <pre>minikube start --cpus 4 --addons ingress</pre>
        </div>
        <p>Then orchest can be installed via orchest-cli</p>
          <div class="highlight">
<pre>
pip install --upgrade orchest-cli 
orchest install
</pre>
        </div>
        <p>Now the cluster can be reached on the IP returned by:</p>
        <div class="highlight">
          <pre>minikube ip</pre>        
        </div>
        <div class="admonition tip">
          <p class="admonition-title">Tip</p>
          <p>👉 We provide an automated convenience script for a complete minikube deployment. Taking care of installing <code class="docutils literal notranslate"><span class="pre">minikube</span></code>, installing the <code class="docutils literal notranslate"><span class="pre">orchest-cli</span></code> and installing Orchest, run it with:</p>
          <div class="highlight">
          <pre>curl -fsSL https://get.orchest.io > convenience_install.sh \\
&& bash convenience_install.sh</pre>
          </div>
        </div>`,
      },
      microK8s: {
        instructions: `After <a href="https://microk8s.io/#install-microk8s">microk8s</a> installation. following addons have to be enabled</p>
        <div class="highlight">
<pre>
microk8s enable hostpath-storage \\
&& microk8s enable dns \\
&& microk8s enable ingress
</pre>
        </div>
        <p>Then orchest can be installed via orchest-cli</p>
        <div class="highlight">
<pre>
pip install --upgrade orchest-cli 
orchest install --socket-path=/var/snap/microk8s/common/run/containerd.sock
</pre>
        </div>`,
      },
    },
    Windows: {
      minikube: {
        instructions: `
        <div class="admonition note">
        <p class="admonition-title">Note</p>
        <p>💡 For Orchest to work on Windows, Docker has to be configured to use WSL 2 (<a class="reference external" href="https://docs.docker.com/desktop/windows/wsl/">Docker Desktop WSL 2
        backend</a>).</p>
        <p>For all further steps make sure to run CLI commands inside a WSL terminal. You can do this by
        opening the distribution using the Start menu or by <a class="reference external" href="https://docs.microsoft.com/en-us/windows/wsl/setup/environment#set-up-windows-terminal">setting up the Windows Terminal</a>.</p>
        </div>
        <p>After <a href="https://minikube.sigs.k8s.io/docs/start/">minikube</a> installation. then create a minikube cluster and configure ingress</p>
        <div class="highlight">
          <pre>minikube start --cpus 4 --addons ingress</pre>
        </div>
        <p>Then orchest can be installed via orchest-cli</p>
          <div class="highlight">
<pre>
pip install --upgrade orchest-cli 
orchest install
</pre>
        </div>
        <p>Now the cluster can be reached on the IP returned by:</p>
        <div class="highlight">
          <pre>minikube ip</pre>        
        </div>
        <div class="admonition tip">
          <p class="admonition-title">Tip</p>
          <p>👉 We provide an automated convenience script for a complete minikube deployment. Taking care of installing <code class="docutils literal notranslate"><span class="pre">minikube</span></code>, installing the <code class="docutils literal notranslate"><span class="pre">orchest-cli</span></code> and installing Orchest, run it with:</p>
          <div class="highlight">
          <pre>curl -fsSL https://get.orchest.io > convenience_install.sh \\
&& bash convenience_install.sh</pre>
          </div>
        </div>
        `,
      },
    },
  };

  let installerContainer = document.querySelector(CONTAINER_CLASS);
  let OSs = Object.keys(installerData);

  let osHtml = OSs.map(
    (os) => `<button 
    class="os"
  onclick="installer_widget.filter('${os}', '${
      Object.keys(installerData[os])[0]
    }')" 
   data-os="${os}">${os}</button>`
  ).join(``);

  let platformHtml = OSs.map((os) =>
    Object.keys(installerData[os])
      .map(
        (distro) =>
          `<button class="distribution" data-os="${os}" data-distro="${distro}" onclick="installer_widget.filter('${os}', '${distro}')">${distro}</button>`
      )
      .join(``)
  ).join(``);

  let instructionsHtml = OSs.map((os) =>
    Object.keys(installerData[os])
      .map(
        (distro) =>
          `<div class="command" data-os="${os}" data-distro="${distro}">${installerData[os][distro].instructions}</div>`
      )
      .join(``)
  ).join(``);

  installerContainer.innerHTML = `
    <div>
      <div class="row">
        <div class="lhs-label">Operating system</div> <div>${osHtml}</div>
      </div>
      <div class="row">
        <div class="lhs-label">K8s distribution</div> <div>${platformHtml}</div>
      </div>
      <div class="row">
        <div class="lhs-label">Installation</div> <div>${instructionsHtml}</div>
      </div>
    </div>
  `;

  function filter(os, distro) {
    let installerContainer = document.querySelector(CONTAINER_CLASS);
    let allButtons = document.querySelectorAll("button");

    allButtons.forEach((e) => e.classList.remove("active"));

    let distroAndinstructions = installerContainer.querySelectorAll(
      "button.distribution, div.command"
    );

    distroAndinstructions.forEach((e) => {
      e.style.display = "none";
    });

    let filtered = installerContainer.querySelectorAll(
      `button.distribution[data-os="${os}"], div.command[data-os="${os}"][data-distro="${distro}"]`
    );

    filtered.forEach((e) => {
      e.style.removeProperty("display");
    });

    let selected = installerContainer.querySelectorAll(
      `button.os[data-os="${os}"], button.distribution[data-os="${os}"][data-distro="${distro}"]`
    );

    selected.forEach((e) => {
      e.classList.add("active");
    });
  }

  // Apply filter initially
  filter(OSs[0], Object.keys(installerData[OSs[0]])[0]);

  // Binding to make onclick attributes work
  window.installer_widget = {
    filter,
  };
});
