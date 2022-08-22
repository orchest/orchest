/*
  Simple widget to the docs.

  Inspiration taken from (and some MIT code copied from):
  https://github.com/medmunds/rate-the-docs

  Thank you Mike Edmunds!
*/
function rateWidgetBlock() {
  function recordEvent(action, label, value) {
    // global gtag;
    // global ga;
    const isLocalhost = window.location.hostname === "localhost";
    const category = "RateTheDocs";
    if (typeof gtag === "function") {
      // ReadTheDocs initializes READTHEDOCS_DATA.user_analytics_code
      // with the project owner's GA trackingId
      gtag("event", action, {
        send_to: READTHEDOCS_DATA.user_analytics_code,
        event_category: category,
        event_label: label,
        value: value,
        dimension1: READTHEDOCS_DATA.project,
        dimension2: READTHEDOCS_DATA.version,
      });
    } else if (typeof ga === "function") {
      // ReadTheDocs initializes the Google Analytics trackerName "user"
      // with the project owner's GA trackingId
      ga("user.send", "event", category, action, label, value, {
        // (dimension order matches readthedocs-analytics.js, merely to avoid confusion)
        dimension1: READTHEDOCS_DATA.project,
        dimension2: READTHEDOCS_DATA.version,
      });
    } else if (isLocalhost) {
      // Local debugging without GA
      console.log("recordEvent", category, action, label, value);
    } else {
      // Either attempt to submit feedback before GA loads (unlikely),
      // or user is blocking GA but has not enabled doNotTrack.
      alert(
        "Unable to register your docs feedback: Google Analytics not loaded"
      );
    }
  }

  const canUseGA = () => {
    // Return true if recording is available and can be used.
    // (Google Analytics loads async, and the ReadTheDocs code that kicks
    // it off is also loaded async—readthedocs-analytics.js—so just assume
    // it will become available later unless the user has enabled doNotTrack.)
    const navigator = window.navigator || {};
    const doNotTrack =
      navigator.doNotTrack === "1" || // Firefox, Chrome
      navigator.msDoNotTrack === "1" || // IE 9, 10
      navigator.doNotTrack === "yes" || // Gecko < 32
      window.doNotTrack === "1"; // Safari, IE 11, Edge
    return !doNotTrack;
  };

  let rateHtml = `<div class="rate-form">
      <form action="/" method="POST">
          <h2>Please rate our docs:</h2>
          <div class="button-block">
              <button value="1">⭐️</button>
              <button value="2">⭐️</button>
              <button value="3">⭐️</button>
              <button value="4">⭐️</button>
              <button value="5">⭐️</button>
          </div>
          <a class="close-link" href="#close">Close</a>
      </form>
      <div class="thank-you">Thank you for rating.</div>
  </div>`;

  const LOCALSTORAGE_PREFIX = "RATE_WIDGET_ORCHEST_";
  const WIDGET_SHOW_DELAY = 20;

  function localStorageGet(key) {
    return localStorage.getItem(LOCALSTORAGE_PREFIX + key);
  }

  function localStorageSet(key, value) {
    localStorage.setItem(LOCALSTORAGE_PREFIX + key, value.toString());
  }

  function appendRateElement() {
    let div = document.createElement("div");
    div.innerHTML = rateHtml;
    window.document.body.appendChild(div);

    // Attach listeners
    let rateForm = document.querySelector(".rate-form");
    let rateFormFormEl = rateForm.querySelector("form");
    rateFormFormEl.addEventListener("submit", (e) => {
      e.preventDefault();
    });

    let buttons = Array.from(rateForm.querySelectorAll("button"));
    buttons.forEach((el) => el.addEventListener("mouseenter", handleEnter));
    let buttonBlock = rateForm.querySelector(".button-block");
    buttons.map((el) => (el.style.opacity = 0.5));

    buttonBlock.addEventListener("mouseleave", () => {
      buttons.map((el) => (el.style.opacity = 0.5));
    });

    let closeEl = rateForm.querySelector("a.close-link");
    closeEl.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      markFormFilled();
      hideForm();
    });

    function handleEnter(e) {
      let thisIndex = buttons.indexOf(e.target);
      buttons.map((el) =>
        buttons.indexOf(el) <= thisIndex
          ? (el.style.opacity = 1)
          : (el.style.opacity = 0.5)
      );
    }

    buttons.forEach((el) => el.addEventListener("click", handleButtonClick));

    function rateCallback(rating) {
      recordEvent("RateTheDocsCustom", "GeneralRating", rating);

      markFormFilled();
      showThankYou();
    }

    function hideForm() {
      rateForm.style.display = "none";
    }

    function markFormFilled() {
      // Set vote localStorage
      localStorageSet("rated", "true");
    }

    function showThankYou() {
      // Hide form, show thank you
      rateForm.querySelector(".thank-you").style.display = "block";
      rateForm.querySelector("form").style.display = "none";

      setTimeout(() => {
        hideForm();
      }, 3000);
    }

    function handleButtonClick(e) {
      let el = e.target;

      e.preventDefault();
      e.stopPropagation();

      // We count 1 to 5, see form HTML.
      try {
        let rating = parseInt(el.attributes.getNamedItem("value").value);
        rateCallback(rating);
      } catch (e) {
        console.error("Failed to record rating", e);
      }
    }
  }

  function incrementViewCount() {
    let count = parseInt(localStorageGet("count")) || 0;
    localStorageSet("count", count + 1);
  }

  function init() {
    if (localStorageGet("rated") !== null) {
      // Only ask users to rate once in each browser
      return;
    }

    if (!canUseGA()) {
      // Use blocks GA tracking
      return;
    }

    // Start counting
    // NOTE: this will count faster when multiple tabs are open
    let incrementInterval = setInterval(() => {
      incrementViewCount();
      let count = parseInt(localStorageGet("count"));

      if (count >= WIDGET_SHOW_DELAY) {
        clearInterval(incrementInterval);
        appendRateElement();
      }
    }, 1000);
  }

  window.document.addEventListener("DOMContentLoaded", function () {
    window.READTHEDOCS_DATA = window.READTHEDOCS_DATA || {};
    init();
  });
}

rateWidgetBlock();
