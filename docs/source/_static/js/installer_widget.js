window.document.addEventListener("DOMContentLoaded", function () {
  const CONTAINER_CLASS = ".installer-container";

  let installerData = {
    "Orchest Cloud": {
      Managed: {
        instructions: `
<p>
Simply go to <a href="https://cloud.orchest.io/signup">Orchest Cloud</a> and get up and running
immediately 🔥.
</p>
            `,
      },
    },
    Cloud: {
      EKS: {
        instructions: `
<p>
Get started by installing <a href="https://kubernetes.io/docs/tasks/tools/">kubectl</a> and setting up an
<a href="https://docs.aws.amazon.com/eks/latest/userguide/getting-started-eksctl.html">EKS cluster</a>
on AWS.
</p>

<p>All that is left is installing Orchest using the <code class="docutils literal notranslate"><span
class="pre">orchest-cli</span></code>:</p>
<div class="highlight">
<pre>
pip install --upgrade orchest-cli
orchest install
</pre>
</div>

<p>Now that Orchest is installed, it can be reached on the address returned by:</p>
<div class="highlight">
<pre>kubectl get service orchest-ingress-nginx-controller -n orchest \\
      -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
</pre>
</div>
</p>
`,
      },
      GKE: {
        instructions: `
<p>Make sure to first create a
<a href="https://cloud.google.com/kubernetes-engine/docs/deploy-app-cluster#create_cluster">GKE cluster</a>
and
<a href="https://cloud.google.com/kubernetes-engine/docs/how-to/cluster-access-for-kubectl">configure kubectl</a>
to access the cluster.
</p>

<p>Now that your GKE cluster is set up correctly, Orchest can be installed using the <code
class="docutils literal notranslate"><span class="pre">orchest-cli</span></code>:</p>
<div class="highlight">
<pre>
pip install --upgrade orchest-cli
orchest install
</pre>
</div>

<p>After installing Orchest, you can reach it on the IP returned by:</p>
<div class="highlight">
<pre>kubectl get service orchest-ingress-nginx-controller -n orchest \\
      -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
</pre>
</div>
</p>
`,
      },
    },
    Linux: {
      minikube: {
        instructions: `
<p>We provide an automated convenience script for a complete <a
href="https://minikube.sigs.k8s.io/docs/start/">minikube</a> deployment. Taking care of installing
minikube, installing the <code class="docutils literal notranslate"><span
class="pre">orchest-cli</span></code> and installing Orchest, run it with:</p>
<div class="highlight">
<pre>
curl -fsSL https://get.orchest.io > convenience_install.sh \\
    && bash convenience_install.sh
</pre>
</div>
<p>In case any of these technologies is already installed on your machine, then the convenience script
will simply proceed to the next step.</p>

<p>Now that Orchest is installed, it can be reached on the IP returned by:</p>
<div class="highlight">
  <pre>minikube ip</pre>
</div>
        `,
      },
    },
  };

  let installerContainer = document.querySelector(CONTAINER_CLASS);
  if (!installerContainer) {
    // Element not found, skip init.
    return;
  }
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
      <div class="section">
        <div class="lhs-label">Deployment environment</div>
        <div class="content">${osHtml}</div>
      </div>
      <div class="section">
        <div class="lhs-label">Kubernetes distribution</div>
        <div class="content">${platformHtml}</div>
      </div>
      <div class="section">
        <div class="lhs-label"><strong>Installation</strong></div>
        <div class="content">${instructionsHtml}</div>
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
