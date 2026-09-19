/* Agent self-service portal — functional layer.
 * Prototype note: localStorage/frontend permissions are not production security.
 */
(function(){
  function init(){
    if(typeof DB==="undefined" || typeof SESSION==="undefined") return;
    DB.agentRequests=Array.isArray(DB.agentRequests)?DB.agentRequests:[];
    DB.agentTasks=Array.isArray(DB.agentTasks)?DB.agentTasks:[];
    DB.agentNotifications=Array.isArray(DB.agentNotifications)?DB.agentNotifications:[];
    function A(){return typeof currentAgent==="function"?currentAgent():DB.agents.find(function(x){return x.id===SESSION.asAgentId;});}
    function now(){return typeof nowStamp==="function"?nowStamp():new Date().toLocaleString("fr-FR");}
    function id(p){return p+"-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,7);}
    function date(v){if(!v)return "—";var d=new Date(v);return isNaN(d)?"—":d.toLocaleDateString("fr-FR");}
    function requests(){return DB.agentRequests.filter(function(x){return x.agentId===SESSION.asAgentId;}).sort(function(a,b){return String(b.createdAt).localeCompare(String(a.createdAt));});}
    function status(s){var x=String(s||"En attente").toLowerCase();if(x.includes("refus")||x.includes("annul"))return badge("Refusée");if(x.includes("valid")||x.includes("termin")||x.includes("accept"))return badge("Validée");return badge(s||"En attente");}
    function notify(title,text){DB.agentNotifications.unshift({id:id("n"),agentId:SESSION.asAgentId,title:title,text:text,date:now(),read:false});}
    function modal(title,body,actions){
      var root=document.getElementById("modalRoot");
      root.innerHTML='<div class="overlay" id="apOverlay"><div class="modal" role="dialog" aria-modal="true"><div class="modal-head"><h3>'+esc(title)+'</h3><div class="spacer"></div><button class="close-x" id="apClose">'+svg(I.x)+'</button></div><div class="modal-body">'+body+'</div><div class="modal-foot">'+actions+'</div></div></div>';
      var close=function(){root.innerHTML="";};
      document.getElementById("apClose").onclick=close;
      document.getElementById("apOverlay").onclick=function(e){if(e.target.id==="apOverlay")close();};
      return close;
    }
    window.openAgentRequestForm=function(type){
      var labels={absence:"Demande d'absence",formation:"Demande de formation",document:"Demande de document RH",profil:"Modification de mes informations",teletravail:"Demande de télétravail",social:"Demande d'action sociale",autre:"Autre demande RH"};
      var title=labels[type]||"Nouvelle demande RH";
      var extra=type==="absence"?'<div class="field"><label>Date de début</label><input type="date" id="apStart"></div><div class="field"><label>Date de fin</label><input type="date" id="apEnd"></div>':"";
      var body='<div class="form-grid"><div class="field"><label>Type</label><input disabled value="'+esc(title)+'"></div><div class="field"><label>Objet <span class="req">*</span></label><input id="apSubject" placeholder="Objet de la demande"></div><div class="field full"><label>Précisions <span class="req">*</span></label><textarea id="apDetails" placeholder="Décrivez votre demande…"></textarea></div>'+extra+'<div class="field full"><span class="hint">La demande est enregistrée dans votre espace et transmise au circuit RH.</span></div></div>';
      var close=modal(title,body,'<button class="btn" id="apCancel">Annuler</button><button class="btn primary" id="apSend">'+svg(I.check,'ic')+' Envoyer</button>');
      document.getElementById("apCancel").onclick=close;
      document.getElementById("apSend").onclick=function(){
        var subject=document.getElementById("apSubject").value.trim(),details=document.getElementById("apDetails").value.trim();
        if(!subject||!details){toast("Objet et précisions sont obligatoires");return;}
        var range="",s=document.getElementById("apStart"),e=document.getElementById("apEnd");if(s&&s.value)range+="Du "+s.value;if(e&&e.value)range+=" au "+e.value;
        DB.agentRequests.unshift({id:id("req"),agentId:SESSION.asAgentId,type:type||"autre",typeLabel:title,subject:subject,details:details+(range?"\n"+range:""),status:"En attente",createdAt:now(),updatedAt:now(),history:[{status:"En attente",date:now(),actor:"Agent"}]});
        notify("Demande envoyée",subject);save();close();render();toast("Demande envoyée à la RH");
      };
    };
    window.openAgentProfileRequest=function(){openAgentRequestForm("profil");};
    window.openAgentDocumentRequest=function(){openAgentRequestForm("document");};
    window.openAgentLeaveRequest=function(){openAgentRequestForm("absence");};
    window.openAgentTrainingRequest=function(){openAgentRequestForm("formation");};

    window.openAgentTask=function(taskId){
      var t=DB.agentTasks.find(function(x){return x.id===taskId;});if(!t)return;
      var body='<div class="info-list"><div class="row"><span class="l">Tâche</span><span class="v">'+esc(t.title||t.libelle||"Tâche")+'</span></div><div class="row"><span class="l">Échéance</span><span class="v">'+esc(date(t.deadline))+'</span></div><div class="row"><span class="l">Statut</span><span class="v">'+status(t.status)+'</span></div></div><div class="field" style="margin-top:14px"><label>Réponse / commentaire</label><textarea id="apTaskComment"></textarea></div><div class="field" style="margin-top:10px"><label>Pièce jointe</label><input type="file" id="apTaskFile"><span class="hint">Prototype : seul le nom du fichier est conservé.</span></div>';
      var close=modal("Ma tâche",body,'<button class="btn" id="apTaskClose">Fermer</button><button class="btn primary" id="apTaskDone">'+svg(I.check,'ic')+' Terminer</button>');
      document.getElementById("apTaskClose").onclick=close;
      document.getElementById("apTaskDone").onclick=function(){t.status="Terminée";t.completedAt=now();t.comment=document.getElementById("apTaskComment").value.trim();var f=document.getElementById("apTaskFile");t.attachmentName=f&&f.files[0]?f.files[0].name:"";notify("Tâche terminée",t.title||"Tâche");save();close();render();toast("Tâche terminée");};
    };
    window.markAgentNotificationsRead=function(){DB.agentNotifications.filter(function(x){return x.agentId===SESSION.asAgentId;}).forEach(function(x){x.read=true;});save();render();};

    window.openAgentReviewComment=function(rid){
      var r=DB.notations.find(function(x){return x.id===rid;});if(!r)return;
      var close=modal("Mon commentaire",' <div class="field"><label>Votre commentaire</label><textarea id="apReview">'+esc(r.commentaireAgent||"")+'</textarea><span class="hint">Votre commentaire est conservé dans le circuit d’évaluation.</span></div>','<button class="btn" id="apRc">Annuler</button><button class="btn primary" id="apRs">Enregistrer</button>');
      document.getElementById("apRc").onclick=close;
      document.getElementById("apRs").onclick=function(){r.commentaireAgent=document.getElementById("apReview").value.trim();r.dateCommentaireAgent=now();notify("Commentaire enregistré","Votre commentaire d’évaluation a été enregistré.");save();close();render();toast("Commentaire enregistré");};
    };

    window.renderAgentDashboard=function(){
      var a=A(),rs=requests(),pending=rs.filter(function(x){return x.status==="En attente"||x.status==="En cours";}).length,unread=DB.agentNotifications.filter(function(x){return x.agentId===SESSION.asAgentId&&!x.read;}).length;
      var tasks=DB.agentTasks.filter(function(x){return x.agentId===SESSION.asAgentId&&!/termin/i.test(String(x.status));}).length;
      return '<div class="detail-head"><div class="av">'+esc(((a&&a.prenom)||"")[0]+((a&&a.nom)||"")[0])+'</div><div><h2>Bonjour '+esc(a&&a.prenom||"")+' 👋</h2><div class="meta">'+esc(a&&a.poste||a&&a.fonction||"Agent")+' · '+esc(a&&a.direction||"")+'</div></div><div class="spacer"></div><button class="btn primary" onclick="openAgentRequestForm()">Nouvelle demande</button></div>'+
      '<div class="kpi-grid"><div class="kpi" onclick="go(\'mes-demandes\')"><div class="k-lbl">Demandes en cours</div><div class="k-val">'+pending+'</div></div><div class="kpi" onclick="go(\'mes-taches\')"><div class="k-lbl">Tâches à faire</div><div class="k-val">'+tasks+'</div></div><div class="kpi" onclick="go(\'mes-notifications\')"><div class="k-lbl">Notifications</div><div class="k-val">'+unread+'</div></div><div class="kpi" onclick="go(\'mes-documents\')"><div class="k-lbl">Documents</div><div class="k-val">'+agentDocs().length+'</div></div></div>'+
      '<div class="panels"><div class="panel"><div class="panel-head"><h3>Accès rapides</h3></div><div class="panel-body"><div class="toolbar"><button class="btn" onclick="go(\'mon-profil\')">Mon profil</button><button class="btn" onclick="go(\'mes-conges\')">Mes absences</button><button class="btn" onclick="go(\'ma-remuneration\')">Ma rémunération</button><button class="btn" onclick="go(\'ma-carriere\')">Ma carrière</button><button class="btn" onclick="go(\'mes-formations\')">Mes formations</button><button class="btn" onclick="go(\'mes-entretiens\')">Mes entretiens</button></div></div></div><div class="panel"><div class="panel-head"><h3>Dernières demandes</h3></div><div class="panel-body">'+(rs.slice(0,5).map(function(r){return '<div class="mini-row"><div><div class="who">'+esc(r.subject)+'</div><div class="det">'+esc(r.typeLabel||r.type)+' · '+esc(date(r.createdAt))+'</div></div><div class="spacer"></div>'+status(r.status)+'</div>';}).join("")||'<div class="empty">Aucune demande récente.</div>')+'</div></div></div>';
    };
    window.renderAgentRequests=function(){
      var rs=requests(),body=rs.map(function(r){return '<div class="mini-row"><div class="av">'+esc((r.typeLabel||"RH").slice(0,2).toUpperCase())+'</div><div><div class="who">'+esc(r.subject)+'</div><div class="det">'+esc(r.typeLabel||r.type)+' · '+esc(date(r.createdAt))+'</div></div><div class="spacer"></div>'+status(r.status)+'</div>';}).join("");
      return '<div class="detail-head"><div><h2>Mes demandes</h2><div class="meta">Toutes vos démarches RH au même endroit</div></div><div class="spacer"></div><button class="btn primary" onclick="openAgentRequestForm()">Nouvelle demande</button></div><div class="toolbar"><button class="btn sm" onclick="openAgentLeaveRequest()">Absence</button><button class="btn sm" onclick="openAgentTrainingRequest()">Formation</button><button class="btn sm" onclick="openAgentDocumentRequest()">Attestation / document</button><button class="btn sm" onclick="openAgentRequestForm(\'teletravail\')">Télétravail</button><button class="btn sm" onclick="openAgentProfileRequest()">Modifier mes informations</button></div><div class="panel"><div class="panel-head"><h3>Historique</h3><div class="spacer"></div><span class="tag">'+rs.length+' demande(s)</span></div><div class="panel-body">'+(body||'<div class="empty">Aucune demande pour le moment.</div>')+'</div></div>';
    };
    window.renderAgentTasks=function(){
      var ts=DB.agentTasks.filter(function(x){return x.agentId===SESSION.asAgentId;});
      var body=ts.map(function(t){return '<div class="tache-row"><div style="flex:1"><div class="cell-name">'+esc(t.title||t.libelle||"Tâche")+'</div><div class="cell-sub">'+esc(t.description||"")+'</div><div class="cell-sub">Échéance : '+esc(date(t.deadline))+'</div></div>'+status(t.status)+'<button class="btn sm" onclick="openAgentTask(\''+esc(t.id)+'\')">'+(/termin/i.test(String(t.status))?"Consulter":"Traiter")+'</button></div>';}).join("");
      return '<div class="detail-head"><div><h2>Mes tâches</h2><div class="meta">Documents et actions à fournir à la RH</div></div><div class="spacer"></div></div><div class="panel"><div class="panel-body"><div class="tache-list">'+(body||'<div class="empty">Aucune tâche en attente.</div>')+'</div></div></div>';
    };
    window.renderAgentNotifications=function(){
      var ns=DB.agentNotifications.filter(function(x){return x.agentId===SESSION.asAgentId;}).sort(function(a,b){return String(b.date).localeCompare(String(a.date));});
      var body=ns.map(function(n){return '<div class="mini-row" style="'+(!n.read?'background:var(--primary-soft);':'')+'"><div class="av">'+(!n.read?"!":"✓")+'</div><div><div class="who">'+esc(n.title)+'</div><div class="det">'+esc(n.text||"")+' · '+esc(date(n.date))+'</div></div><div class="spacer"></div>'+badge(n.read?"Lue":"Non lue")+'</div>';}).join("");
      return '<div class="detail-head"><div><h2>Notifications</h2><div class="meta">'+ns.filter(function(x){return !x.read;}).length+' non lue(s)</div></div><div class="spacer"></div><button class="btn" onclick="markAgentNotificationsRead()">Tout marquer comme lu</button></div><div class="panel"><div class="panel-body">'+(body||'<div class="empty">Aucune notification.</div>')+'</div></div>';
    };
    window.renderAgentProfile=function(){
      var a=A();if(!a)return '<div class="empty">Profil introuvable.</div>';
      var c=(a.enfants||[]).length;
      return '<div class="detail-head"><div class="av">'+esc((a.prenom||"")[0]+(a.nom||"")[0])+'</div><div><h2>Mon profil</h2><div class="meta">'+esc(agentName(a.id))+' · '+esc(a.matricule||"")+'</div></div><div class="spacer"></div><button class="btn primary" onclick="openAgentProfileRequest()">'+svg(I.edit,'ic')+' Demander une modification</button></div><div class="detail-cols"><div class="panel"><div class="panel-head"><h3>Informations personnelles</h3></div><div class="panel-body"><div class="info-list"><div class="row"><span class="l">Nom</span><span class="v">'+esc(a.nom||"—")+'</span></div><div class="row"><span class="l">Prénom</span><span class="v">'+esc(a.prenom||"—")+'</span></div><div class="row"><span class="l">Date de naissance</span><span class="v">'+esc(a.dateNaissance||"—")+'</span></div><div class="row"><span class="l">Situation familiale</span><span class="v">'+esc(a.situationFamiliale||"—")+'</span></div><div class="row"><span class="l">Enfants à charge</span><span class="v">'+c+'</span></div><div class="row"><span class="l">Email</span><span class="v">'+esc(a.email||a.emailPro||"—")+'</span></div><div class="row"><span class="l">Téléphone</span><span class="v">'+esc(a.telephone||a.tel||"—")+'</span></div></div></div></div><div class="panel"><div class="panel-head"><h3>Situation professionnelle</h3></div><div class="panel-body"><div class="info-list"><div class="row"><span class="l">Direction</span><span class="v">'+esc(a.direction||"—")+'</span></div><div class="row"><span class="l">Poste</span><span class="v">'+esc(a.poste||a.fonction||"—")+'</span></div><div class="row"><span class="l">Statut</span><span class="v">'+esc(a.statut||"—")+'</span></div><div class="row"><span class="l">Grade / échelon</span><span class="v">'+esc(a.grade||"—")+' / '+esc(a.echelon||"—")+'</span></div><div class="row"><span class="l">Entrée</span><span class="v">'+esc(a.dateEntree||"—")+'</span></div><div class="row"><span class="l">Quotité</span><span class="v">'+esc(a.quotite||100)+' %</span></div></div></div></div></div>';
    };
    window.renderAgentReviews=function(){
      var rs=typeof agentReviews==="function"?agentReviews():[];
      var body=rs.map(function(r){return '<div class="panel" style="margin-bottom:12px"><div class="panel-head"><h3>'+esc(r.campagne||r.periode||"Entretien")+'</h3><div class="spacer"></div><strong>'+esc(r.note!=null?r.note+"/20":"—")+'</strong></div><div class="panel-body"><div class="cell-sub">Commentaire du responsable</div><p>'+esc(r.commentaireResponsable||r.commentaireManager||"—")+'</p><div class="cell-sub">Mon commentaire</div><p>'+esc(r.commentaireAgent||"Non renseigné")+'</p><button class="btn sm" onclick="openAgentReviewComment(\''+esc(r.id)+'\')">Ajouter / modifier</button></div></div>';}).join("");
      return '<div class="detail-head"><div><h2>Mes entretiens</h2><div class="meta">Évaluations et observations de l’agent</div></div></div>'+(body||'<div class="empty">Aucun entretien disponible.</div>');
    };
    window.renderAgentLife=function(){
      var a=A();
      return '<div class="detail-head"><div><h2>Ma vie professionnelle</h2><div class="meta">Organisation et dispositifs au sein de l’OPH</div></div></div><div class="kpi-grid"><div class="kpi"><div class="k-lbl">Quotité</div><div class="k-val">'+esc(a&&a.quotite||100)+' %</div></div><div class="kpi"><div class="k-lbl">Pause déjeuner</div><div class="k-val">30 min</div></div><div class="kpi"><div class="k-lbl">Horaires</div><div class="k-val" style="font-size:18px">07:30–15:30</div></div></div><div class="panels"><div class="panel"><div class="panel-head"><h3>Organisation</h3></div><div class="panel-body"><div class="info-list"><div class="row"><span class="l">Vendredi</span><span class="v">07:30–14:30</span></div><div class="row"><span class="l">Pause</span><span class="v">30 min</span></div><div class="row"><span class="l">Direction</span><span class="v">'+esc(a&&a.direction||"—")+'</span></div></div></div></div><div class="panel"><div class="panel-head"><h3>Mes démarches</h3></div><div class="panel-body"><div class="toolbar"><button class="btn sm" onclick="openAgentRequestForm(\'teletravail\')">Télétravail</button><button class="btn sm" onclick="openAgentRequestForm(\'social\')">Action sociale</button><button class="btn sm" onclick="openAgentDocumentRequest()">Attestation / document</button></div></div></div></div>';
    };
    window.renderAgentMaternity=function(){
      var a=A(),m=(DB.maternite||[]).find(function(x){return x.agentId===a.id;}),docs=agentDocs().filter(function(d){return /mater|parent/i.test(String(d.categorie||d.type||""));});
      return '<div class="detail-head"><div><h2>Maternité / parentalité</h2><div class="meta">Suivi administratif et pièces à fournir</div></div><div class="spacer"></div><button class="btn" onclick="openAgentDocumentRequest()">Demander un document</button></div><div class="kpi-grid"><div class="kpi"><div class="k-lbl">Dossier</div><div class="k-val">'+(m?"Ouvert":"—")+'</div></div><div class="kpi"><div class="k-lbl">Documents liés</div><div class="k-val">'+docs.length+'</div></div></div><div class="panel"><div class="panel-head"><h3>Suivi</h3></div><div class="panel-body"><p class="hint">Les tâches administratives et documents nécessaires sont suivis ici. Les données médicales ne sont pas exposées dans l’espace agent.</p></div></div>';
    };
    window.renderAgentTraining=function(){
      var fs=typeof agentForms==="function"?agentForms():[];
      var rows=fs.map(function(f){return '<tr><td class="cell-name">'+esc(f.intitule||f.nom||f.formation||"Formation")+'</td><td>'+esc(f.organisme||f.provider||"—")+'</td><td>'+esc(f.date||f.dateDebut||"—")+'</td><td>'+esc(f.duree||"—")+'</td><td>'+status(f.statut||"Terminée")+'</td><td>'+((f.evaluationChaud||f.evaluationFroid)?'<span class="tag">Évaluations</span>':"—")+'</td></tr>';}).join("");
      return '<div class="detail-head"><div><h2>Mes formations</h2><div class="meta">Historique et évaluations</div></div><div class="spacer"></div><button class="btn primary" onclick="openAgentTrainingRequest()">Demander une formation</button></div><div class="table-wrap"><table><thead><tr><th>Formation</th><th>Organisme</th><th>Date</th><th>Durée</th><th>Statut</th><th>Évaluation</th></tr></thead><tbody>'+(rows||'<tr><td colspan="6" class="empty">Aucune formation.</td></tr>')+'</tbody></table></div>';
    };
    if(SESSION.role==="agent" && typeof render==="function") setTimeout(render,0);
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init); else init();
})();