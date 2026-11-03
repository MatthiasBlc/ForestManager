<title>Modele de donnees V2</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700&family=Manrope:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Layout : document technique, sommaire collant sur grand ecran ; fiches de tables generees depuis schema.prisma. Couleurs : ambiance Braise du design system */
:root {
  --bg: #f5f3ef; --surface: #fbfaf7; --raised: #ffffff; --line: #ddd6cb; --line-strong: #918a7f;
  --ink: #1f1d1a; --muted: #5f5a53; --accent: #b8611a; --accent-soft: #f3e6da; --accent-text: #8f4a12;
  --second: #46607f; --second-soft: #e6ebf0; --warn-soft: #f6ead2; --warn-text: #7a5300;
  --f-display: "Sora", "Segoe UI", system-ui, sans-serif; --f-body: "Manrope", "Segoe UI", system-ui, sans-serif; --f-mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #16181b; --surface: #1f2226; --raised: #282c31; --line: #32363c; --line-strong: #74777c;
  --ink: #eceae6; --muted: #a6a39e; --accent: #e8913a; --accent-soft: #3d2c1d; --accent-text: #efa868;
  --second: #8fa8c8; --second-soft: #2a313b; --warn-soft: #3b3020; --warn-text: #e8b44a; color-scheme: dark; } }
:root[data-theme="dark"] {
  --bg: #16181b; --surface: #1f2226; --raised: #282c31; --line: #32363c; --line-strong: #74777c;
  --ink: #eceae6; --muted: #a6a39e; --accent: #e8913a; --accent-soft: #3d2c1d; --accent-text: #efa868;
  --second: #8fa8c8; --second-soft: #2a313b; --warn-soft: #3b3020; --warn-text: #e8b44a; color-scheme: dark; }
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--ink); font-family: var(--f-body); font-size: 15px; line-height: 1.55; }
.wrap { max-width: 1200px; margin: 0 auto; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 28px 64px; display: grid; grid-template-columns: 210px minmax(0, 1fr); gap: 40px; }
nav.toc { position: sticky; top: calc(env(safe-area-inset-top, 0px) + 20px); align-self: start; display: flex; flex-direction: column; gap: 2px; font-size: 13.5px; }
nav.toc b { font-family: var(--f-display); font-size: 16px; margin-bottom: 10px; color: var(--accent-text); }
nav.toc a { color: var(--muted); text-decoration: none; padding: 5px 10px; border-left: 2px solid var(--line); }
nav.toc a:hover, nav.toc a:focus-visible { color: var(--ink); border-left-color: var(--accent); outline: none; }
main { min-width: 0; display: flex; flex-direction: column; gap: 48px; }
section { display: flex; flex-direction: column; gap: 14px; scroll-margin-top: 20px; }
h1, h2, h3 { font-family: var(--f-display); margin: 0; line-height: 1.15; text-wrap: balance; }
h1 { font-size: clamp(28px, 4.2vw, 40px); }
h2 { font-size: 24px; }
h3 { font-size: 16px; }
p { margin: 0; max-width: 74ch; }
.eyebrow { font-family: var(--f-mono); font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
.small { font-size: 13px; color: var(--muted); }
code { font-family: var(--f-mono); font-size: .86em; background: var(--accent-soft); color: var(--ink); padding: 1px 5px; border-radius: 4px; overflow-wrap: anywhere; }
.facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1px; background: var(--line); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
.fact { background: var(--raised); padding: 12px 14px; display: flex; flex-direction: column; }
.fact b { font-family: var(--f-display); font-size: 24px; font-variant-numeric: tabular-nums; }
.fact span { font-size: 12.5px; color: var(--muted); }
.tablebox { overflow-x: auto; border: 1px solid var(--line); border-radius: 12px; background: var(--raised); }
table { border-collapse: collapse; width: 100%; font-size: 14px; }
th, td { text-align: left; padding: 9px 12px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); background: var(--surface); }
tr:last-child td { border-bottom: 0; }
pre.mermaid { background: var(--raised); border: 1px solid var(--line); border-radius: 12px; padding: 14px; overflow-x: auto; margin: 0; }
pre.code { background: var(--raised); border: 1px solid var(--line); border-radius: 12px; padding: 14px; overflow-x: auto; margin: 0; font: 13px/1.6 var(--f-mono); white-space: pre; }
.tools { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.tools input { font: 400 15px/22px var(--f-body); color: var(--ink); background: var(--raised); border: 1px solid var(--line-strong); border-radius: 10px; padding: 8px 12px; min-width: 0; flex: 1 1 240px; }
.tools input:focus-visible, .chip:focus-visible, summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.chip { font: 600 13px/18px var(--f-body); border: 1px solid var(--line-strong); background: var(--raised); color: var(--ink); border-radius: 999px; padding: 6px 12px; cursor: pointer; }
.chip[aria-pressed="true"] { background: var(--accent-soft); color: var(--accent-text); border-color: var(--accent-text); }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
details.model { background: var(--raised); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; min-width: 0; }
details.model summary { cursor: pointer; padding: 12px 14px; display: flex; flex-direction: column; gap: 4px; list-style: none; }
details.model summary::-webkit-details-marker { display: none; }
.mhead { display: flex; flex-wrap: wrap; gap: 6px; align-items: baseline; }
.mname { font: 600 15px/20px var(--f-mono); }
.pill { font: 700 11px/16px var(--f-body); padding: 1px 7px; border-radius: 6px; background: var(--second-soft); color: var(--second); }
.pill.d { background: var(--accent-soft); color: var(--accent-text); }
.mdoc { font-size: 13.5px; color: var(--muted); }
.fields { border-top: 1px solid var(--line); padding: 6px 0; font-size: 13px; }
.f { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; padding: 4px 14px; }
.f:nth-child(odd) { background: var(--surface); }
.fn { font-family: var(--f-mono); overflow-wrap: anywhere; }
.ft { font-family: var(--f-mono); color: var(--muted); overflow-wrap: anywhere; }
.ft.rel { color: var(--second); }
.ft.enum { color: var(--accent-text); }
.fc { grid-column: 1 / -1; color: var(--muted); font-size: 12.5px; padding-left: 10px; }
.attrs { border-top: 1px solid var(--line); padding: 8px 14px; font: 12px/1.6 var(--f-mono); color: var(--muted); overflow-wrap: anywhere; }
.enums { display: flex; flex-wrap: wrap; gap: 8px; }
.enum { background: var(--raised); border: 1px solid var(--line); border-radius: 10px; padding: 8px 12px; font-size: 13px; min-width: 0; }
.enum b { font-family: var(--f-mono); }
.enum span { font-family: var(--f-mono); color: var(--muted); }
.dec { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px; }
.dec div { background: var(--raised); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 6px; }
.dec .q { border-color: var(--warn-text); background: var(--warn-soft); }
.count { font-size: 13px; color: var(--muted); }
@media (max-width: 880px) {
  .wrap { grid-template-columns: minmax(0, 1fr); gap: 20px; padding-block: 20px 48px; }
  nav.toc { position: static; flex-direction: row; flex-wrap: wrap; gap: 6px; }
  nav.toc b { width: 100%; margin-bottom: 0; }
  nav.toc a { border: 1px solid var(--line); border-radius: 999px; padding: 3px 10px; }
  .cards { grid-template-columns: minmax(0, 1fr); }
}
</style>

<div class="wrap">
<nav class="toc" aria-label="Sommaire">
  <b>Modele V2</b>
  <a href="#resume">Resume</a>
  <a href="#changements">Ce qui change</a>
  <a href="#vue">Vue d'ensemble</a>
  <a href="#exemple">Exemple</a>
  <a href="#tables">Tables</a>
  <a href="#enums">Enumerations</a>
  <a href="#contraintes">Contraintes</a>
  <a href="#decisions">Choix</a>
</nav>
<main>

<section id="resume">
  <div class="eyebrow">Rework V2 - roadmap B1 - valide le 2026-11-03</div>
  <h1>Le modele de donnees de la V2</h1>
  <p>Le schema Prisma cible, traduit des decisions du journal. Il est valide par Prisma mais n'est branche a rien. Les fiches de cette page sont generees depuis le fichier <code>schema.prisma</code> du chantier : elles disent exactement ce qu'il contient.</p>
  <div class="facts" id="facts"></div>
</section>

<section id="changements">
  <div class="eyebrow">Par rapport a la V1</div>
  <h2>Ce qui change</h2>
  <div class="tablebox"><table>
    <thead><tr><th>Sujet</th><th>V1</th><th>V2</th><th>Decision</th></tr></thead>
    <tbody>
      <tr><td>Espace perso</td><td><code>communityId = null</code></td><td><code>Space</code> de type <code>PERSONAL</code>, lie a son utilisateur</td><td>D02</td></tr>
      <tr><td>Recette partagee</td><td>2 a N lignes <code>Recipe</code> synchronisees</td><td>Une <code>Recipe</code> + des <code>RecipeShare</code></td><td>D03</td></tr>
      <tr><td>Version d'un autre espace</td><td>Fork, variante automatique</td><td><code>adaptedFromId</code> + <code>adaptedFromRevision</code></td><td>D17</td></tr>
      <tr><td>Contenu d'une recette</td><td>Ingredients et etapes a plat</td><td><code>RecipeBlock</code> local ou lien vivant vers une autre recette</td><td>D24</td></tr>
      <tr><td>Historique</td><td>Aucun</td><td><code>RecipeRevision</code> en instantane JSON</td><td>D05, D30</td></tr>
      <tr><td>Proposition</td><td>Tables <code>ProposalStep</code>, <code>ProposalIngredient</code></td><td><code>RecipeSuggestion</code> : instantane propose + revision de base</td><td>D04</td></tr>
      <tr><td>Tags</td><td>PENDING, suggestions, masquage</td><td>Globaux traduits + tags d'espace libres, poses par espace</td><td>D08, D19, D27</td></tr>
      <tr><td>Ingredients</td><td>Nom unique, PENDING</td><td>Traduits, <code>NEW</code> utilisable tout de suite, fusion, rayon</td><td>D09, D34, D36</td></tr>
      <tr><td>Unites</td><td>Categories, pas de conversion</td><td>Dimension + facteur vers la base, poids par ingredient</td><td>D36</td></tr>
      <tr><td>Modules</td><td><code>Feature</code> accorde par l'admin</td><td><code>Module</code>, <code>SpaceModule</code>, <code>ModuleAccessRequest</code></td><td>D33</td></tr>
      <tr><td>Roles</td><td>MEMBER, MODERATOR</td><td>+ OWNER unique (index partiel)</td><td>D06</td></tr>
      <tr><td>Invitations</td><td>Par username</td><td>Liens d'invitation + username exact</td><td>D07</td></tr>
      <tr><td>Planning</td><td>Midi / soir en dur, <code>editableByMembers</code></td><td><code>MealPlanSettings</code> : repas choisis, role minimal d'edition</td><td>D11</td></tr>
      <tr><td>Notifications, activite</td><td>Enums en base</td><td>Cles texte declarees par les modules</td><td>D40, D41</td></tr>
      <tr><td>Retire</td><td colspan="2"><code>Visibility</code>, <code>RecipeView</code>, <code>RecipeAnalytics</code>, <code>TagSuggestion</code>, <code>UserCommunityTagPreference</code>, <code>isVariant</code>, <code>sharedFromCommunityId</code></td><td>D27, D39</td></tr>
    </tbody>
  </table></div>
</section>

<section id="vue">
  <div class="eyebrow">Relations principales</div>
  <h2>Vue d'ensemble</h2>
  <p class="small">Socle a gauche (il ne connait aucun module), puis le module Recettes et le module Planning qui s'y rattachent par l'espace.</p>
<pre class="mermaid">
erDiagram
  User ||--o| Space : "espace perso"
  User ||--o{ Membership : ""
  Space ||--o{ Membership : "role"
  Space ||--o{ SpaceModule : "modules accordes"
  Module ||--o{ SpaceModule : ""
  Space ||--o{ ModuleAccessRequest : "demandes"
  Space ||--o{ Recipe : "espace d'origine"
  User ||--o{ Recipe : "auteur"
  Recipe ||--o{ RecipeShare : "partagee dans"
  Space ||--o{ RecipeShare : ""
  Recipe ||--o{ RecipeBlock : "blocs"
  RecipeBlock }o--o| Recipe : "lien vivant"
  Recipe ||--o{ RecipeRevision : "historique"
  Recipe ||--o{ RecipeSuggestion : ""
  Recipe |o--o{ Recipe : "adaptation"
  Space ||--o{ MealPlan : ""
  MealPlan ||--o{ MealSlot : ""
  MealSlot }o--o| Recipe : ""
</pre>
<pre class="mermaid">
erDiagram
  RecipeBlock ||--o{ RecipeIngredient : ""
  RecipeBlock ||--o{ RecipeStep : ""
  RecipeIngredient }o--|| Ingredient : ""
  RecipeIngredient }o--o| Unit : ""
  Ingredient ||--o{ IngredientTranslation : "nom par langue"
  Ingredient ||--o{ IngredientUnitWeight : "poids par unite"
  Ingredient }o--o| Aisle : "rayon"
  Recipe ||--o{ RecipeGlobalTag : ""
  Recipe ||--o{ RecipeSpaceTag : "par espace"
  Tag ||--o{ RecipeSpaceTag : ""
  Tag ||--o{ TagTranslation : "tags globaux"
</pre>
</section>

<section id="exemple">
  <div class="eyebrow">Exemple concret</div>
  <h2>Saumon teriyaki et brocolis, en base</h2>
  <p>La recette composee de la maquette, telle qu'elle serait enregistree. La sauce est une recette a part, liee par un bloc ; elle est partagee dans TOM en meme temps que le plat.</p>
<pre class="code">Recipe  "Sauce teriyaki"      homeSpace=Famille  isBase=true  yield=300 ml  currentRevision=2
  RecipeBlock #0  LOCAL
    RecipeIngredient  100  ml           sauce soja
    RecipeIngredient   60  ml           mirin
    RecipeIngredient    2  c. a soupe   sucre
    RecipeStep        "Melanger soja, mirin et sucre."

Recipe  "Saumon teriyaki et brocolis"   homeSpace=Famille  yield=2 (portions)
  RecipeBlock #0  RECIPE  subRecipe="Sauce teriyaki"  subQuantity=150  subUnit=ml   -> facteur 0,5
  RecipeBlock #1  LOCAL   title="Saumon et brocolis"
    RecipeIngredient    2  piece        pave de saumon
    RecipeIngredient  300  g            brocoli
  RecipeBlock #2  LOCAL   title="Assemblage"

RecipeShare  "Saumon teriyaki et brocolis" -> TOM
RecipeShare  "Sauce teriyaki"              -> TOM   viaRecipe="Saumon teriyaki et brocolis"
RecipeSpaceTag  (Saumon..., Famille, "Rapide")      RecipeSpaceTag  (Saumon..., TOM, "Plat du lundi")
RecipeRevision  (Sauce teriyaki, n=2, source=SUGGESTION)   le plat voit la revision 2 (lien vivant)</pre>
</section>

<section id="tables">
  <div class="eyebrow">Fiches generees depuis schema.prisma</div>
  <h2>Les tables</h2>
  <div class="tools">
    <input id="q" type="search" placeholder="Filtrer : recipe, space, D17, deletedAt..." aria-label="Filtrer les tables">
    <span class="count" id="count"></span>
  </div>
  <div class="tools" id="domains" role="group" aria-label="Domaines"></div>
  <div class="cards" id="cards"></div>
</section>

<section id="enums">
  <h2>Enumerations</h2>
  <div class="enums" id="enumlist"></div>
</section>

<section id="contraintes">
  <h2>Contraintes ajoutees en SQL</h2>
  <p class="small">Prisma ne sait pas exprimer les index partiels ni les CHECK : elles seront ecrites dans les migrations. Les dernieres lignes listent ce que l'application verifie elle-meme.</p>
  <pre class="code" id="cons"></pre>
</section>

<section id="decisions">
  <div class="eyebrow">Valide le 2026-11-03</div>
  <h2>Choix faits en construisant le modele</h2>
  <div class="dec">
    <div><b>D41 - Types de notification et d'activite en cles texte</b><span class="small">Chaque module declare ses types ("recipes.suggestion.created") dans le registre ; le package partage les valide. Pas d'enum en base, donc pas de migration du socle pour un nouveau module. Precise F-NOT-3 (qui parlait d'enum).</span></div>
    <div><b>D42 - Suggestions et revisions au meme format</b><span class="small">Une suggestion porte un instantane complet propose, compare a sa revision de base. Remplace les tables ProposalStep et ProposalIngredient de la V1.</span></div>
    <div><b>D43 - Compteurs calcules, pas stockes</b><span class="small">"Planifiee N fois", "derniere fois cuisinee" se calculent depuis les repas du planning (index recette + date). Rien a resynchroniser.</span></div>
    <div><b>D44 - Compte supprime : ligne anonymisee</b><span class="small">La ligne User reste (username et email remplaces) pour que les recettes laissees aux espaces gardent un auteur "ancien membre".</span></div>
    <div><b>D45 - Referentiels traduits par tables de traduction</b><span class="small">Ingredients, unites, rayons et tags globaux ont une ligne par langue (recherche et unicite par langue). Les tags d'espace gardent un nom simple.</span></div>
    <div><b>D46 - Conversions d'unites</b><span class="small">Chaque unite a une dimension (masse, volume, piece, aucune) et un facteur vers la base (g, ml) ; un poids par ingredient et par unite permet d'additionner pieces et grammes.</span></div>
    <div><b>D47 - Partage automatique trace</b><span class="small">Une sous-recette partagee avec un plat garde le lien <code>viaRecipeId</code> : retirer le plat d'un espace propose de retirer aussi la sauce, sauf si elle y a ete partagee pour elle-meme.</span></div>
    <div><b>D58 - Planning : MEMBER par defaut</b><span class="small">Tous les membres modifient les repas (<code>MealPlanSettings.editRole = MEMBER</code>) ; l'OWNER peut restreindre. Generation et reglages : moderateurs et OWNER.</span></div>
    <div><b>D81 - Partager la recette d'un autre</b><span class="small">Demande de partage (<code>RecipeShareRequest</code>) acceptee par l'auteur, ou partage immediat si l'auteur a coche <code>Membership.allowMembersToShare</code> dans cet espace.</span></div>
    <div><b>D82 - Espace perso et "Mes recettes"</b><span class="small">L'espace perso montre son contenu propre et une vue "Mes recettes" de toutes les recettes dont on est l'auteur : simple requete sur <code>Recipe.authorId</code>, rien a dupliquer.</span></div>
    <div><b>D83 - Espace d'origine purge</b><span class="small">Ses recettes partagees ailleurs sont rapatriees dans l'espace perso de leur auteur (changement de <code>homeSpaceId</code>).</span></div>
  </div>
</section>

</main>
</div>

<script>
(function () {
  "use strict";
  var DATA = __DATA__;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var short = function (d) { return d.replace(/^(SOCLE|MODULE|PLATEFORME) - /, "").replace(/ \[.*$/, ""); };
  var nCons = (DATA.constraints.match(/^\d+\./gm) || []).length;
  document.getElementById("facts").innerHTML = [
    [DATA.models.length, "tables"], [DATA.enums.length, "enumerations"], [DATA.domains.length, "domaines"], [nCons, "contraintes SQL en plus"]
  ].map(function (f) { return '<div class="fact"><b>' + f[0] + '</b><span>' + f[1] + '</span></div>'; }).join("");
  var state = { q: "", d: "all" };
  try { var s = JSON.parse(localStorage.getItem("fm-model-filter") || "null"); if (s) state = s; } catch (e) {}
  function chips() {
    var items = [["all", "Tous"]].concat(DATA.domains.map(function (d) { return [d, short(d)]; }));
    document.getElementById("domains").innerHTML = items.map(function (it) {
      return '<button type="button" class="chip" data-d="' + esc(it[0]) + '" aria-pressed="' + (state.d === it[0]) + '">' + esc(it[1]) + '</button>';
    }).join("");
  }
  function card(m) {
    var fields = m.fields.map(function (f) {
      var cls = f.rel ? " rel" : (f.enum ? " enum" : "");
      var a = f.a.replace(/@relation\([^)]*\)/, "@relation").trim();
      return '<div class="f"><span class="fn">' + esc(f.n) + '</span><span class="ft' + cls + '">' + esc(f.t) + (a ? " " + esc(a) : "") + '</span>' + (f.c ? '<span class="fc">' + esc(f.c) + '</span>' : '') + '</div>';
    }).join("");
    var ds = m.d.map(function (d) { return '<span class="pill d">' + esc(d) + '</span>'; }).join("");
    return '<details class="model"><summary><span class="mhead"><span class="mname">' + esc(m.name) + '</span><span class="pill">' + esc(short(m.domain)) + '</span>' + ds + '</span>' +
      (m.doc ? '<span class="mdoc">' + esc(m.doc) + '</span>' : '') + '<span class="small">' + m.fields.length + ' champs - toucher pour detailler</span></summary>' +
      '<div class="fields">' + fields + '</div>' + (m.attrs.length ? '<div class="attrs">' + m.attrs.map(esc).join("<br>") + '</div>' : '') + '</details>';
  }
  function render() {
    var q = state.q.toLowerCase();
    var list = DATA.models.filter(function (m) {
      if (state.d !== "all" && m.domain !== state.d) return false;
      if (!q) return true;
      return JSON.stringify(m).toLowerCase().indexOf(q) >= 0;
    });
    document.getElementById("cards").innerHTML = list.map(card).join("") || '<p class="small">Aucune table ne correspond.</p>';
    document.getElementById("count").textContent = list.length + " / " + DATA.models.length + " tables";
    chips();
    try { localStorage.setItem("fm-model-filter", JSON.stringify(state)); } catch (e) {}
  }
  document.getElementById("q").value = state.q;
  document.getElementById("q").addEventListener("input", function (e) { state.q = e.target.value; render(); });
  document.getElementById("domains").addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; state.d = b.getAttribute("data-d"); render(); });
  document.getElementById("enumlist").innerHTML = DATA.enums.map(function (e) {
    return '<div class="enum"><b>' + esc(e.name) + '</b> <span>' + e.values.map(function (v) { return esc(v[0]); }).join(" | ") + '</span></div>';
  }).join("");
  document.getElementById("cons").textContent = DATA.constraints;
  render();
})();
</script>
