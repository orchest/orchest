window.document.addEventListener("DOMContentLoaded", function () {
  const CONTAINER_CLASS = ".installer-container";

  let installerData = {
    Cloud: {
      GKE: {
        instructions: `<p>Some paragraph with a link <a href="https://minikube.sigs.k8s.io/docs/start/">to minikube</a>.</p>
        <div class="highlight">
          <pre>minikube start</pre>
        </div>`,
      },
      EKS: {
        instructions: ``,
      },
    },
    Linux: {
      minikube: {
        instructions: ``,
      },
      k3s: {
        instructions: ``,
      },
      kind: {
        instructions: ``,
      },
      MicroK8s: {
        instructions: ``,
      },
      "Docker for Desktop": {
        instructions: ``,
      },
    },
    macOS: {
      minikube: {
        instructions: ``,
      },
      k3s: {
        instructions: ``,
      },
      kind: {
        instructions: ``,
      },
      "Docker for Desktop": {
        instructions: ``,
      },
    },
    Windows: {
      minikube: {
        instructions: ``,
      },
      "Docker for Desktop": {
        instructions: ``,
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
        <div>Operating system</div> <div>${osHtml}</div>
      </div>
      <div class="row">
        <div>K8s distribution</div> <div>${platformHtml}</div>
      </div>
      <div class="row">
        <div>Installation</div> <div>${instructionsHtml}</div>
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
