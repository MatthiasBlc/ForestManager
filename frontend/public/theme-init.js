(function() {
  var t = localStorage.getItem("forestmanager-theme");
  if (t === "forest" || t === "winter") {
    document.documentElement.setAttribute("data-theme", t);
  } else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
    document.documentElement.setAttribute("data-theme", "winter");
  } else {
    document.documentElement.setAttribute("data-theme", "forest");
  }
})();
