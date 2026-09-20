// Ajoute une recherche par saisie aux listes déroulantes (<select>) qui ont beaucoup d'options
// (tiers, comptes budgétaires, agents, logements, documents…), dans tous les modules de l'ERP.
// Le <select> d'origine n'est jamais remplacé (même id, mêmes valeurs, évènement "change"
// toujours déclenché normalement), donc toujours pilotable par page.selectOption() dans les
// tests. La saisie fait apparaître une liste de suggestions cliquables juste en dessous : la
// choisir met à jour le <select> (et donc son affichage), plutôt que de masquer ses <option> —
// un <select> fermé continue sinon d'afficher l'option sélectionnée même si elle est masquée,
// ce qui est trompeur (constaté sur mobile : la recherche semblait ne rien faire).
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
    `;
    document.head.appendChild(style);
  }
  function ameliorer(select){
    if(select.dataset.searchEnhanced) return;
    if(select.multiple || select.options.length<=SEUIL_OPTIONS) return;
    select.dataset.searchEnhanced="1";

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

    // Si le <select> est resélectionné par un autre moyen (natif, ou par le code de l'appli),
    // on garde le champ de recherche vide plutôt que désynchronisé avec la sélection réelle.
    select.addEventListener("change", ()=>{ if(document.activeElement!==input) input.value=""; });
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
