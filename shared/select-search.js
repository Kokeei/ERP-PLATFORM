// Remplace visuellement les listes déroulantes (<select>) qui ont beaucoup d'options (tiers,
// comptes budgétaires, agents, logements, documents…) par un champ de recherche, dans tous les
// modules de l'ERP. Le <select> d'origine n'est jamais retiré du DOM ni désactivé (même id,
// mêmes valeurs, évènement "change" toujours déclenché normalement) — seulement masqué à
// l'écran (pas en display:none/visibility:hidden, pour rester actionnable) — donc toujours
// pilotable par page.selectOption() dans les tests. Taper dans le champ fait apparaître une
// liste de suggestions cliquables ; en choisir une met à jour le <select> cité et donc ce que
// le champ affiche. Le champ reflète aussi la sélection déjà en place à l'ouverture d'un
// formulaire d'édition.
(function(){
  const SEUIL_OPTIONS = 6; // en dessous, une recherche n'apporte rien et ajoute du bruit visuel
  function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  function normalise(s){
    return String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
  }
  function injecterStyle(){
    const style=document.createElement("style");
    style.textContent=`
      .select-search-wrap{position:relative}
      .select-search-input{display:block;width:100%;box-sizing:border-box;margin-bottom:4px;padding:6px 9px;font-size:13px;border:1px solid var(--border,#ccc);border-radius:6px;background:var(--surface,#fff);color:var(--ink,#111)}
      .select-search-list{position:absolute;left:0;right:0;top:100%;z-index:80;max-height:220px;overflow-y:auto;border:1px solid var(--border,#ccc);border-radius:8px;background:var(--surface,#fff);box-shadow:0 8px 24px rgba(0,0,0,.15);margin-top:-2px}
      .select-search-item{padding:8px 11px;font-size:13.5px;color:var(--ink,#111);cursor:pointer}
      .select-search-item:hover,.select-search-item.active{background:var(--surface-2,var(--bg,#f0f0f0))}
      .select-search-empty{padding:8px 11px;font-size:13px;color:var(--ink-3,#888)}
      .select-search-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;opacity:0;pointer-events:none}
    `;
    document.head.appendChild(style);
  }
  function ameliorer(select){
    if(select.dataset.searchEnhanced) return;
    if(select.multiple || select.options.length<=SEUIL_OPTIONS) return;
    select.dataset.searchEnhanced="1";
    // Le <select> natif est masqué visuellement (pas en display:none/visibility:hidden, pour
    // rester actionnable par les tests) : la recherche + ses suggestions le remplacent
    // entièrement à l'écran, pour ne pas avoir deux façons différentes de choisir affichées
    // en même temps.
    select.classList.add("select-search-hidden");

    const wrap=document.createElement("div");
    wrap.className="select-search-wrap";
    select.insertAdjacentElement("beforebegin", wrap);

    const input=document.createElement("input");
    input.type="text";
    input.autocomplete="off";
    input.spellcheck=false;
    input.placeholder="Rechercher…";
    input.className="select-search-input";
    wrap.appendChild(input);

    const list=document.createElement("div");
    list.className="select-search-list";
    list.style.display="none";
    wrap.appendChild(list);

    function optionsReelles(){
      return Array.from(select.options).filter(o=>o.value!=="");
    }
    function fermer(){ list.style.display="none"; list.innerHTML=""; }
    function ouvrir(q){
      const query=normalise(q);
      const matches=optionsReelles().filter(o=>normalise(o.textContent).includes(query));
      if(!query){ fermer(); return; }
      if(!matches.length){ list.innerHTML=`<div class="select-search-empty">Aucun résultat</div>`; list.style.display="block"; return; }
      list.innerHTML=matches.slice(0,50).map(o=>`<div class="select-search-item" data-value="${esc(o.value)}">${esc(o.textContent)}</div>`).join("");
      list.style.display="block";
    }
    function choisir(value, label){
      select.value=value;
      select.dispatchEvent(new Event("change", {bubbles:true}));
      input.value=label;
      fermer();
    }
    // Le <select> étant masqué, le champ de recherche est la seule chose visible : il doit
    // toujours refléter la sélection réelle (valeur initiale à l'ouverture d'un formulaire
    // d'édition, ou changement fait par un autre moyen que cette recherche), sauf pendant que
    // l'utilisateur est en train d'y taper une nouvelle recherche.
    function syncInputDepuisSelect(){
      if(document.activeElement===input) return;
      const opt=select.options[select.selectedIndex];
      input.value=(opt && opt.value!=="") ? opt.textContent : "";
    }

    input.addEventListener("input", ()=>ouvrir(input.value));
    input.addEventListener("focus", ()=>{ if(input.value) ouvrir(input.value); });
    input.addEventListener("keydown", (e)=>{
      if(e.key==="Escape") fermer();
      if(e.key==="Enter"){
        e.preventDefault();
        const first=list.querySelector(".select-search-item");
        if(first) choisir(first.dataset.value, first.textContent);
      }
    });
    list.addEventListener("mousedown", (e)=>{
      const item=e.target.closest(".select-search-item");
      if(!item) return;
      e.preventDefault(); // évite que le blur de l'input ferme la liste avant le clic
      choisir(item.dataset.value, item.textContent);
    });
    document.addEventListener("click", (e)=>{ if(!wrap.contains(e.target)) fermer(); });
    select.addEventListener("change", syncInputDepuisSelect);
    syncInputDepuisSelect();
  }
  function parcourir(racine){
    (racine||document).querySelectorAll("select").forEach(ameliorer);
  }
  const observer=new MutationObserver(mutations=>{
    for(const m of mutations){
      m.addedNodes.forEach(node=>{
        if(node.nodeType!==1) return;
        if(node.tagName==="SELECT") ameliorer(node);
        else if(node.querySelectorAll) parcourir(node);
      });
    }
  });
  function demarrer(){
    injecterStyle();
    parcourir(document);
    observer.observe(document.body, {childList:true, subtree:true});
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", demarrer);
  else demarrer();
  window.enhanceSearchableSelects = parcourir;
})();
