/* @ds-bundle: {"format":4,"namespace":"ForestUI","components":[{"name":"Icon"},{"name":"Button"},{"name":"IconButton"},{"name":"Field"},{"name":"Switch"},{"name":"Stepper"},{"name":"SegmentedControl"},{"name":"Badge"},{"name":"Chip"},{"name":"Avatar"},{"name":"EmptyState"},{"name":"Sheet"},{"name":"ActionMenu"},{"name":"Toast"},{"name":"CommandPalette"},{"name":"SpaceRail"},{"name":"ModuleNav"},{"name":"TabBar"},{"name":"TopBar"},{"name":"AppShell"},{"name":"RecipeCard"},{"name":"IngredientRow"},{"name":"RecipeBlock"},{"name":"MealSlot"},{"name":"PullToRefresh"}]} */
(function () {
  "use strict";
  var R = window.React;
  var h = R.createElement,
    useState = R.useState,
    useRef = R.useRef,
    useEffect = R.useEffect;

  function cx() {
    var out = [];
    for (var i = 0; i < arguments.length; i++) if (arguments[i]) out.push(arguments[i]);
    return out.join(" ");
  }
  function omit(obj, keys) {
    var o = {};
    for (var k in obj)
      if (Object.prototype.hasOwnProperty.call(obj, k) && keys.indexOf(k) < 0) o[k] = obj[k];
    return o;
  }

  /* Icones de remplacement au trait (grille 24, trait 2) dans l'esprit de Lucide.
     L'application utilisera lucide-react ; ces noms correspondent aux siens. */
  var PATHS = {
    "book-open": [
      "M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2z",
      "M22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z",
    ],
    calendar: [
      "M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
      "M3 10h18",
      "M8 2v4",
      "M16 2v4",
    ],
    "shopping-basket": ["M3 10h18l-2 10H5z", "M8 10l4-7 4 7", "M9 14v3", "M15 14v3"],
    users: [
      "M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1",
      "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
      "M22 20v-1a4 4 0 0 0-3-3.9",
      "M16 3.1a4 4 0 0 1 0 7.8",
    ],
    settings: [
      "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
      "M12 2v3",
      "M12 19v3",
      "M2 12h3",
      "M19 12h3",
      "M4.9 4.9l2.1 2.1",
      "M17 17l2.1 2.1",
      "M4.9 19.1L7 17",
      "M17 7l2.1-2.1",
    ],
    search: ["M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z", "M21 21l-4.3-4.3"],
    bell: ["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.9 1.9 0 0 0 3.4 0"],
    plus: ["M12 5v14", "M5 12h14"],
    minus: ["M5 12h14"],
    x: ["M18 6L6 18", "M6 6l12 12"],
    check: ["M20 6L9 17l-5-5"],
    more: ["M5 12h.01", "M12 12h.01", "M19 12h.01"],
    pencil: ["M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z"],
    share: [
      "M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
      "M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
      "M18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
      "M8.6 13.5l6.8 4",
      "M15.4 6.5l-6.8 4",
    ],
    "git-branch": [
      "M6 3v12",
      "M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
      "M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
      "M18 9a9 9 0 0 1-9 9",
    ],
    trash: ["M3 6h18", "M8 6V4h8v2", "M19 6l-1 14H6L5 6"],
    link: [
      "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7",
      "M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7",
    ],
    "chevron-down": ["M6 9l6 6 6-6"],
    "chevron-right": ["M9 18l6-6-6-6"],
    lock: ["M5 11h14v10H5z", "M8 11V7a4 4 0 0 1 8 0v4"],
    clock: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 6v6l4 2"],
    refresh: [
      "M21 12a9 9 0 0 1-15.5 6.2L3 16",
      "M3 12a9 9 0 0 1 15.5-6.2L21 8",
      "M21 3v5h-5",
      "M3 21v-5h5",
    ],
    "chef-hat": ["M6 13.9A4 4 0 0 1 7.5 6a5 5 0 0 1 9 0A4 4 0 0 1 18 13.9V21H6z", "M6 17h12"],
    home: ["M3 10l9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M9 22V12h6v10"],
    sparkles: [
      "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
      "M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z",
    ],
  };
  function Icon(p) {
    var d = PATHS[p.name] || PATHS.more;
    return h(
      "svg",
      {
        className: cx("fm-icon", p.className),
        viewBox: "0 0 24 24",
        "aria-hidden": p.label ? undefined : "true",
        role: p.label ? "img" : undefined,
        "aria-label": p.label,
        style: p.size ? { width: p.size, height: p.size } : undefined,
      },
      d.map(function (path, i) {
        return h("path", { key: i, d: path });
      })
    );
  }

  function Button(p) {
    var rest = omit(p, ["variant", "size", "icon", "block", "className", "children"]);
    return h(
      "button",
      Object.assign({ type: "button" }, rest, {
        className: cx(
          "fm-btn",
          "fm-btn-" + (p.variant || "secondary"),
          p.size === "sm" && "fm-btn-sm",
          p.block && "fm-btn-block",
          p.className
        ),
      }),
      p.icon ? h(Icon, { name: p.icon }) : null,
      p.children
    );
  }

  function IconButton(p) {
    var rest = omit(p, ["icon", "label", "count", "outline", "className"]);
    return h(
      "button",
      Object.assign({ type: "button", "aria-label": p.label, title: p.label }, rest, {
        className: cx("fm-iconbtn", p.outline && "fm-iconbtn-outline", p.className),
      }),
      h(Icon, { name: p.icon }),
      p.count
        ? h(
            "span",
            { className: "fm-count", "aria-hidden": "true" },
            p.count > 99 ? "99+" : p.count
          )
        : null
    );
  }

  var fieldSeq = 0;
  function Field(p) {
    var idRef = useRef(p.id || "fm-field-" + ++fieldSeq);
    var id = idRef.current,
      hintId = id + "-hint";
    var rest = omit(p, ["label", "hint", "error", "multiline", "id", "className"]);
    var ctrl = h(
      p.multiline ? "textarea" : "input",
      Object.assign(
        {
          id: id,
          className: "fm-input",
          "aria-invalid": p.error ? "true" : undefined,
          "aria-describedby": p.hint || p.error ? hintId : undefined,
        },
        rest
      )
    );
    return h(
      "div",
      { className: cx("fm-field", p.error && "fm-field-error", p.className) },
      h("label", { className: "fm-label", htmlFor: id }, p.label),
      ctrl,
      p.error || p.hint ? h("span", { className: "fm-hint", id: hintId }, p.error || p.hint) : null
    );
  }

  function Switch(p) {
    var st = useState(!!p.defaultChecked),
      on = p.checked !== undefined ? p.checked : st[0];
    function toggle() {
      var n = !on;
      if (p.checked === undefined) st[1](n);
      if (p.onChange) p.onChange(n);
    }
    return h(
      "label",
      { className: "fm-switch" },
      h("button", {
        type: "button",
        role: "switch",
        "aria-checked": String(on),
        className: "fm-switch-track",
        onClick: toggle,
      }),
      h("span", null, p.label)
    );
  }

  function Stepper(p) {
    var min = p.min == null ? 1 : p.min,
      max = p.max == null ? 24 : p.max;
    var st = useState(p.defaultValue || min),
      v = p.value !== undefined ? p.value : st[0];
    function set(n) {
      n = Math.max(min, Math.min(max, n));
      if (p.value === undefined) st[1](n);
      if (p.onChange) p.onChange(n);
    }
    var label = p.format ? p.format(v) : v + (p.unit ? " " + p.unit : "");
    return h(
      "div",
      { className: "fm-stepper", role: "group", "aria-label": p.label },
      h(
        "button",
        {
          type: "button",
          "aria-label": "Moins",
          disabled: v <= min,
          onClick: function () {
            set(v - 1);
          },
        },
        h(Icon, { name: "minus" })
      ),
      h("output", { "aria-live": "polite" }, label),
      h(
        "button",
        {
          type: "button",
          "aria-label": "Plus",
          disabled: v >= max,
          onClick: function () {
            set(v + 1);
          },
        },
        h(Icon, { name: "plus" })
      )
    );
  }

  function SegmentedControl(p) {
    var st = useState(p.defaultValue || (p.options[0] && p.options[0].value)),
      v = p.value !== undefined ? p.value : st[0];
    return h(
      "div",
      { className: "fm-seg", role: "group", "aria-label": p.label },
      p.options.map(function (o) {
        return h(
          "button",
          {
            key: o.value,
            type: "button",
            "aria-pressed": String(o.value === v),
            onClick: function () {
              if (p.value === undefined) st[1](o.value);
              if (p.onChange) p.onChange(o.value);
            },
          },
          o.label
        );
      })
    );
  }

  function Badge(p) {
    return h(
      "span",
      {
        className: cx(
          "fm-badge",
          p.tone && p.tone !== "neutral" && "fm-badge-" + p.tone,
          p.className
        ),
      },
      p.icon ? h(Icon, { name: p.icon, size: 14 }) : null,
      p.children
    );
  }

  function Chip(p) {
    var st = useState(!!p.defaultSelected),
      on = p.selected !== undefined ? p.selected : st[0];
    return h(
      "button",
      {
        type: "button",
        className: "fm-chip",
        "aria-pressed": String(on),
        onClick: function () {
          if (p.selected === undefined) st[1](!on);
          if (p.onToggle) p.onToggle(!on);
        },
      },
      on ? h(Icon, { name: "check", size: 16 }) : null,
      p.children
    );
  }

  function initials(name) {
    var parts = String(name || "?")
      .trim()
      .split(/\s+/);
    return ((parts[0] || "?")[0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
  }
  function Avatar(p) {
    var size = p.size || 32;
    var style = { width: size, height: size, fontSize: Math.round(size * 0.4) };
    if (p.tint) {
      style.background = "var(--tint-" + p.tint + ")";
      style.color = "var(--on-tint-" + p.tint + ")";
      style.borderColor = "transparent";
    }
    return h(
      "span",
      { className: "fm-avatar", style: style, title: p.name, "aria-label": p.name, role: "img" },
      p.src ? h("img", { src: p.src, alt: "" }) : initials(p.name)
    );
  }

  function EmptyState(p) {
    return h(
      "div",
      { className: "fm-empty" },
      h("div", { className: "fm-empty-icon" }, h(Icon, { name: p.icon || "book-open" })),
      h("h3", null, p.title),
      p.children ? h("p", null, p.children) : null,
      p.action || null
    );
  }

  /* Sheet : feuille du bas sur mobile (glisser vers le bas pour fermer), dialogue centre a partir de 768px. */
  function Sheet(p) {
    var drag = useState(0),
      dy = drag[0],
      setDy = drag[1];
    var start = useRef(null),
      sheetRef = useRef(null);
    useEffect(
      function () {
        if (!p.open) return;
        function onKey(e) {
          if (e.key === "Escape" && p.onClose) p.onClose();
        }
        document.addEventListener("keydown", onKey);
        if (sheetRef.current) sheetRef.current.focus();
        return function () {
          document.removeEventListener("keydown", onKey);
        };
      },
      [p.open]
    );
    if (!p.open) return null;
    function down(e) {
      start.current = e.clientY;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    function move(e) {
      if (start.current == null) return;
      setDy(Math.max(0, e.clientY - start.current));
    }
    function up() {
      if (start.current == null) return;
      start.current = null;
      if (dy > 110 && p.onClose) p.onClose();
      setDy(0);
    }
    return h(
      "div",
      { className: cx("fm-layer", "fm-root", p.contained && "fm-contained") },
      h("div", { className: "fm-overlay", onClick: p.onClose }),
      h(
        "div",
        {
          className: "fm-sheet",
          role: "dialog",
          "aria-modal": "true",
          "aria-label": p.title,
          tabIndex: -1,
          ref: sheetRef,
          style: dy ? { transform: "translateY(" + dy + "px)", transition: "none" } : undefined,
        },
        h("div", {
          className: "fm-sheet-grip",
          onPointerDown: down,
          onPointerMove: move,
          onPointerUp: up,
          onPointerCancel: up,
          "aria-hidden": "true",
        }),
        h(
          "div",
          {
            className: "fm-sheet-head",
            onPointerDown: down,
            onPointerMove: move,
            onPointerUp: up,
            onPointerCancel: up,
          },
          h("h2", null, p.title),
          h(IconButton, { icon: "x", label: "Fermer", onClick: p.onClose })
        ),
        h("div", { className: "fm-sheet-body" }, p.children),
        p.footer ? h("div", { className: "fm-sheet-foot" }, p.footer) : null
      )
    );
  }

  /* Appui long : declenche cb apres ms millisecondes sans mouvement ; annule le clic qui suit. */
  function useLongPress(cb, ms) {
    var timer = useRef(null),
      fired = useRef(false),
      origin = useRef(null),
      pr = useState(false);
    function clear() {
      clearTimeout(timer.current);
      timer.current = null;
      pr[1](false);
    }
    return {
      pressing: pr[0],
      handlers: {
        onPointerDown: function (e) {
          fired.current = false;
          origin.current = [e.clientX, e.clientY];
          pr[1](true);
          timer.current = setTimeout(function () {
            fired.current = true;
            pr[1](false);
            cb();
          }, ms || 500);
        },
        onPointerMove: function (e) {
          if (
            origin.current &&
            (Math.abs(e.clientX - origin.current[0]) > 8 ||
              Math.abs(e.clientY - origin.current[1]) > 8)
          )
            clear();
        },
        onPointerUp: clear,
        onPointerLeave: clear,
        onPointerCancel: clear,
        onContextMenu: function (e) {
          e.preventDefault();
        },
        onClickCapture: function (e) {
          if (fired.current) {
            e.stopPropagation();
            e.preventDefault();
            fired.current = false;
          }
        },
      },
    };
  }

  function ActionMenu(p) {
    return h(
      "ul",
      { className: "fm-menu", role: "menu", "aria-label": p.label },
      p.items.map(function (it, i) {
        if (it === "-") return h("li", { key: i, role: "separator" }, h("hr"));
        return h(
          "li",
          { key: it.id || i, role: "none" },
          h(
            "button",
            {
              type: "button",
              role: "menuitem",
              className: it.danger ? "fm-danger" : undefined,
              onClick: function () {
                if (p.onSelect) p.onSelect(it.id);
              },
            },
            it.icon ? h(Icon, { name: it.icon }) : null,
            it.label
          )
        );
      })
    );
  }

  function Toast(p) {
    return h(
      "div",
      { className: cx("fm-toast", p.tone && "fm-toast-" + p.tone), role: "status" },
      h("i", { className: "fm-toast-dot", "aria-hidden": "true" }),
      h("span", null, p.children),
      p.actionLabel
        ? h(Button, { variant: "ghost", size: "sm", onClick: p.onAction }, p.actionLabel)
        : null
    );
  }

  function CommandPalette(p) {
    var q = useState(p.defaultQuery || ""),
      sel = useState(0);
    var query = q[0].toLowerCase();
    var flat = [];
    var groups = p.groups
      .map(function (g) {
        var items = g.items.filter(function (it) {
          return !query || it.label.toLowerCase().indexOf(query) >= 0;
        });
        items.forEach(function (it) {
          flat.push(it);
        });
        return { label: g.label, items: items };
      })
      .filter(function (g) {
        return g.items.length;
      });
    function key(e) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        sel[1](Math.min(flat.length - 1, sel[0] + 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        sel[1](Math.max(0, sel[0] - 1));
      }
      if (e.key === "Enter" && flat[sel[0]] && p.onSelect) p.onSelect(flat[sel[0]].id);
    }
    var n = -1;
    return h(
      "div",
      { className: "fm-cmd", role: "dialog", "aria-label": "Recherche" },
      h(
        "div",
        { className: "fm-cmd-input" },
        h(Icon, { name: "search" }),
        h("input", {
          value: q[0],
          placeholder: p.placeholder || "Rechercher une recette, un ingredient, un membre",
          "aria-label": "Rechercher",
          onChange: function (e) {
            q[1](e.target.value);
            sel[1](0);
          },
          onKeyDown: key,
        }),
        h("span", { className: "fm-kbd" }, "Echap")
      ),
      groups.length
        ? groups.map(function (g) {
            return h(
              "div",
              { key: g.label, className: "fm-cmd-group", role: "listbox", "aria-label": g.label },
              h("span", null, g.label),
              g.items.map(function (it) {
                n++;
                var idx = n;
                return h(
                  "button",
                  {
                    key: it.id,
                    type: "button",
                    role: "option",
                    className: "fm-cmd-item",
                    "aria-selected": String(idx === sel[0]),
                    onMouseEnter: function () {
                      sel[1](idx);
                    },
                    onClick: function () {
                      if (p.onSelect) p.onSelect(it.id);
                    },
                  },
                  h(Icon, { name: it.icon || "book-open" }),
                  it.label,
                  it.hint ? h("small", null, it.hint) : null
                );
              })
            );
          })
        : h(
            "div",
            { className: "fm-cmd-group" },
            h("span", null, 'Aucun resultat pour "' + q[0] + '"')
          )
    );
  }

  function SpaceRail(p) {
    function item(s) {
      var style = s.tint
        ? { "--tint": "var(--tint-" + s.tint + ")", "--tint-ink": "var(--on-tint-" + s.tint + ")" }
        : undefined;
      return h(
        "button",
        {
          key: s.id,
          type: "button",
          className: "fm-space",
          style: style,
          title: s.name,
          "aria-label": s.name + (s.unread ? ", nouveautes" : ""),
          "aria-current": s.id === p.activeId ? "true" : undefined,
          onClick: function () {
            if (p.onSelect) p.onSelect(s.id);
          },
        },
        s.image ? h("img", { src: s.image, alt: "" }) : initials(s.name),
        s.unread ? h("i", { className: "fm-space-dot", "aria-hidden": "true" }) : null
      );
    }
    return h(
      "nav",
      { className: "fm-rail", "aria-label": "Espaces" },
      p.personal ? item(p.personal) : null,
      p.personal ? h("span", { className: "fm-rail-sep", "aria-hidden": "true" }) : null,
      p.spaces.map(item),
      h(
        "button",
        {
          type: "button",
          className: "fm-space fm-space-add",
          "aria-label": "Creer ou rejoindre un espace",
          title: "Creer ou rejoindre un espace",
          onClick: p.onAdd,
        },
        h(Icon, { name: "plus" })
      )
    );
  }

  function ModuleNav(p) {
    return h(
      "aside",
      { className: "fm-nav", "aria-label": "Modules de l'espace" },
      h(
        "div",
        { className: "fm-nav-head" },
        h("b", null, p.spaceName),
        p.subtitle ? h("small", null, p.subtitle) : null
      ),
      h(
        "ul",
        null,
        p.items.map(function (it) {
          return h(
            "li",
            { key: it.id },
            h(
              "a",
              {
                href: it.href || "#" + it.id,
                "aria-current": it.id === p.activeId ? "page" : undefined,
                onClick: function (e) {
                  if (p.onSelect) {
                    e.preventDefault();
                    p.onSelect(it.id);
                  }
                },
              },
              h(Icon, { name: it.icon }),
              it.label,
              it.badge ? h(Badge, { tone: it.badgeTone }, it.badge) : null
            )
          );
        })
      )
    );
  }

  function TabBar(p) {
    return h(
      "nav",
      { className: "fm-tabbar", "aria-label": "Navigation" },
      p.items.map(function (it) {
        return h(
          "a",
          {
            key: it.id,
            href: it.href || "#" + it.id,
            "aria-current": it.id === p.activeId ? "page" : undefined,
            onClick: function (e) {
              if (p.onSelect) {
                e.preventDefault();
                p.onSelect(it.id);
              }
            },
          },
          h(Icon, { name: it.icon }),
          it.label
        );
      })
    );
  }

  function TopBar(p) {
    return h(
      "header",
      { className: "fm-top" },
      h("span", { className: "fm-top-title" }, p.title),
      h(
        "button",
        { type: "button", className: "fm-search", onClick: p.onSearch },
        h(Icon, { name: "search" }),
        h("span", null, "Rechercher une recette, un ingredient, un membre"),
        h("span", { className: "fm-kbd" }, "Ctrl K")
      ),
      h(IconButton, {
        icon: "search",
        label: "Rechercher",
        className: "fm-top-search-mobile",
        onClick: p.onSearch,
      }),
      h(IconButton, {
        icon: "bell",
        label: "Notifications",
        count: p.unread,
        onClick: p.onNotifications,
      }),
      p.user ? h(Avatar, { name: p.user, size: 32 }) : null
    );
  }

  function AppShell(p) {
    return h(
      "div",
      { className: "fm-shell fm-root", "data-space": p.tint || undefined },
      h(
        "div",
        { className: "fm-shell-grid" },
        p.rail,
        p.nav,
        p.top,
        h("main", { className: "fm-shell-main" }, p.children),
        p.tabbar
      )
    );
  }

  function RecipeCard(p) {
    var lp = useLongPress(function () {
      if (p.onActions) p.onActions();
    }, 500);
    return h(
      "article",
      Object.assign(
        {
          className: cx("fm-rcard", lp.pressing && "fm-pressing"),
          tabIndex: 0,
          "aria-label": p.title,
          onClick: p.onOpen,
          onKeyDown: function (e) {
            if (e.key === "Enter" && p.onOpen) p.onOpen();
            if ((e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) && p.onActions) {
              e.preventDefault();
              p.onActions();
            }
          },
        },
        lp.handlers
      ),
      h(
        "div",
        {
          className: "fm-rcard-img",
          style: p.image
            ? undefined
            : { background: "linear-gradient(140deg, var(--accent-soft), var(--surface))" },
        },
        p.image ? h("img", { src: p.image, alt: "" }) : null,
        p.badges && p.badges.length
          ? h(
              "div",
              { className: "fm-badges" },
              p.badges.map(function (b, i) {
                return h(Badge, { key: i, tone: b.tone, icon: b.icon }, b.label);
              })
            )
          : null
      ),
      h(
        "div",
        { className: "fm-rcard-body" },
        h("b", null, p.title),
        p.meta ? h("small", null, p.meta) : null
      ),
      p.onActions
        ? h(IconButton, {
            icon: "more",
            label: "Actions pour " + p.title,
            className: "fm-rcard-more",
            onClick: function (e) {
              e.stopPropagation();
              p.onActions();
            },
          })
        : null
    );
  }

  function fmtQty(n) {
    if (n == null) return "";
    var r = Math.round(n * 10) / 10;
    return String(r).replace(".", ",");
  }
  function IngredientRow(p) {
    var st = useState(!!p.defaultChecked),
      on = p.checked !== undefined ? p.checked : st[0];
    function toggle() {
      if (p.checked === undefined) st[1](!on);
      if (p.onToggle) p.onToggle(!on);
    }
    return h(
      "div",
      {
        className: "fm-ing",
        role: "checkbox",
        "aria-checked": String(on),
        tabIndex: 0,
        onClick: toggle,
        onKeyDown: function (e) {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            toggle();
          }
        },
      },
      h(
        "span",
        { className: "fm-ing-box", "aria-hidden": "true" },
        on ? h(Icon, { name: "check", size: 14 }) : null
      ),
      h("span", { className: "fm-ing-qty" }, fmtQty(p.quantity) + (p.unit ? " " + p.unit : "")),
      h("span", { className: "fm-ing-name" }, p.name)
    );
  }

  function RecipeBlock(p) {
    var st = useState(p.defaultOpen !== false),
      open = st[0];
    var linked = p.kind === "linked",
      factor = p.factor || 1;
    var body = open
      ? h(
          "div",
          { className: "fm-block-body" },
          h(
            "div",
            null,
            (p.ingredients || []).map(function (it, i) {
              return h(IngredientRow, {
                key: i,
                quantity: it.quantity == null ? null : it.quantity * factor,
                unit: it.unit,
                name: it.name,
              });
            })
          ),
          p.steps && p.steps.length
            ? h(
                "ol",
                null,
                p.steps.map(function (s, i) {
                  return h("li", { key: i }, s);
                })
              )
            : null
        )
      : null;
    return h(
      "section",
      { className: cx("fm-block", linked && "fm-block-linked"), "aria-label": p.title },
      h(
        "div",
        { className: "fm-block-head" },
        linked ? h(Icon, { name: "link" }) : null,
        h(
          "div",
          { style: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column" } },
          h(
            "span",
            { className: "fm-block-kind" },
            linked ? "Recette liee" : p.title ? "Bloc" : "Ingredients et etapes"
          ),
          h("b", null, p.title || "Recette")
        ),
        linked && p.quantity ? h("span", { className: "fm-block-qty" }, p.quantity) : null,
        h(IconButton, {
          icon: open ? "chevron-down" : "chevron-right",
          label: open ? "Replier" : "Deplier",
          "aria-expanded": String(open),
          onClick: function () {
            st[1](!open);
          },
        })
      ),
      body
    );
  }

  function MealSlot(p) {
    var kind = p.disabled ? "off" : p.kind || "empty";
    var lp = useLongPress(function () {
      if (p.onActions) p.onActions();
    }, 500);
    var label =
      kind === "empty"
        ? p.placeholder || "Ajouter un repas"
        : kind === "off"
          ? p.title || "Pas de repas"
          : p.title;
    return h(
      "button",
      Object.assign(
        {
          type: "button",
          className: cx("fm-slot", "fm-slot-" + kind),
          disabled: kind === "off",
          onClick: p.onOpen,
          "aria-label": (p.when ? p.when + " : " : "") + label + (p.locked ? ", verrouille" : ""),
        },
        kind === "off" ? {} : lp.handlers
      ),
      kind === "empty" ? h(Icon, { name: "plus" }) : null,
      h("span", null, label),
      p.servings && kind !== "empty" && kind !== "off"
        ? h("small", null, p.servings + " p.")
        : null,
      p.locked ? h(Icon, { name: "lock", label: "Verrouille" }) : null
    );
  }

  /* Tirer pour rafraichir : sur une liste tout en haut, tirer de plus de 64px declenche onRefresh (promesse). */
  function PullToRefresh(p) {
    var pull = useState(0),
      busy = useState(false),
      start = useRef(null),
      box = useRef(null);
    function down(e) {
      if (busy[0] || (box.current && box.current.scrollTop > 0)) return;
      start.current = e.clientY;
    }
    function move(e) {
      if (start.current == null) return;
      var d = e.clientY - start.current;
      if (d > 0) pull[1](Math.min(110, d * 0.6));
    }
    function up() {
      if (start.current == null) return;
      start.current = null;
      if (pull[0] > 64 && p.onRefresh) {
        busy[1](true);
        pull[1](56);
        Promise.resolve(p.onRefresh()).then(
          function () {
            busy[1](false);
            pull[1](0);
          },
          function () {
            busy[1](false);
            pull[1](0);
          }
        );
      } else pull[1](0);
    }
    return h(
      "div",
      {
        className: "fm-ptr",
        ref: box,
        onPointerDown: down,
        onPointerMove: move,
        onPointerUp: up,
        onPointerLeave: up,
        onPointerCancel: up,
        style: p.height ? { height: p.height, overflowY: "auto" } : undefined,
      },
      h(
        "div",
        {
          className: cx("fm-ptr-ind", busy[0] && "fm-ptr-spin"),
          style: {
            transform: "translate(-50%, " + (pull[0] - 48) + "px) rotate(" + pull[0] * 3 + "deg)",
          },
          "aria-hidden": "true",
        },
        h(Icon, { name: "refresh" })
      ),
      h(
        "div",
        {
          style: {
            transform: "translateY(" + pull[0] + "px)",
            transition: start.current == null ? "transform .2s" : "none",
          },
        },
        p.children
      ),
      busy[0] ? h("span", { className: "fm-sr", role: "status" }, "Actualisation") : null
    );
  }

  var api = {
    Icon: Icon,
    Button: Button,
    IconButton: IconButton,
    Field: Field,
    Switch: Switch,
    Stepper: Stepper,
    SegmentedControl: SegmentedControl,
    Badge: Badge,
    Chip: Chip,
    Avatar: Avatar,
    EmptyState: EmptyState,
    Sheet: Sheet,
    ActionMenu: ActionMenu,
    Toast: Toast,
    CommandPalette: CommandPalette,
    SpaceRail: SpaceRail,
    ModuleNav: ModuleNav,
    TabBar: TabBar,
    TopBar: TopBar,
    AppShell: AppShell,
    RecipeCard: RecipeCard,
    IngredientRow: IngredientRow,
    RecipeBlock: RecipeBlock,
    MealSlot: MealSlot,
    PullToRefresh: PullToRefresh,
    useLongPress: useLongPress,
  };
  window.ForestUI = Object.assign(window.ForestUI || {}, api);
})();
