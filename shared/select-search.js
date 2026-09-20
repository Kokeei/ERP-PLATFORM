// Ajoute une recherche par saisie aux listes déroulantes (<select>) qui ont beaucoup d'options
// (tiers, comptes budgétaires, agents, logements, documents…), dans tous les modules de l'ERP.
// Reste un <select> natif intact (mêmes id/valeurs/évènements "change") : seules les <option>
// qui ne correspondent pas à la saisie sont masquées. Ne casse donc ni les tests automatisés
// (page.selectOption cible toujours le même <select>) ni la sémantique de formulaire native.
(function(){
  const SEUIL_OPTIONS = 6; // en dessous, une recherche n'apporte rien et ajoute du bruit visuel
  function injecterStyle(){
    const style=document.createElement("style");
    style.textContent=".select-search-input{display:block;width:100%;box-sizing:border-box;margin-bottom:4px;padding:6px 9px;font-size:13px;border:1px solid var(--border,#ccc);border-radius:6px;background:var(--surface,#fff);color:var(--ink,#111)}";
    document.head.appendChild(style);
  }
  function normalise(s){
    return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  }
  function filtrer(select, input){
    const q=normalise(input.value);
    Array.from(select.options).forEach(opt=>{ opt.hidden = !!q && !normalise(opt.textContent).includes(q); });
  }
  function ameliorer(select){
    if(select.dataset.searchEnhanced) return;
    if(select.multiple || select.options.length<=SEUIL_OPTIONS) return;
    select.dataset.searchEnhanced="1";
    const input=document.createElement("input");
    input.type="text";
    input.autocomplete="off";
    input.spellcheck=false;
    input.placeholder="Rechercher…";
    input.className="select-search-input";
    select.insertAdjacentElement("beforebegin", input);
    input.addEventListener("input", ()=>filtrer(select, input));
    // Si la liste d'options change (rendu dynamique), on ré-applique le filtre en cours.
    new MutationObserver(()=>filtrer(select, input)).observe(select, {childList:true});
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
