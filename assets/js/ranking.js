import { db } from "./firebase.js";
import {
  collection, getDocs, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

async function loadCandidates(){
  const q = query(collection(db, "candidates"), orderBy("avgScore100","desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}

function fmt(n){
  const x = Number(n||0);
  return x.toFixed(2);
}

(async function(){
  const mount = document.getElementById("rank");
  if(!mount) return;

  const cands = await loadCandidates();

  if(!cands.length){
    mount.innerHTML = `<div class="card" style="padding:16px;margin-top:12px">Nenhum candidato ainda.</div>`;
    return;
  }

  const top3 = cands.slice(0,3);
  const rest = cands.slice(3);

  mount.innerHTML =
    top3.map((c,i)=>`
      <div class="card" style="padding:16px;margin-top:12px">
        <b>TOP ${i+1}</b>
        <div style="margin-top:8px;font-size:18px;font-weight:900">${c.nomeArtistico || c.nome}</div>
        <div style="color:var(--muted)">${c.genero || "—"} • ${c.cidade || ""}</div>
        <div style="margin-top:10px;font-size:26px;font-weight:950;background:linear-gradient(90deg,var(--gold1),var(--gold2));-webkit-background-clip:text;color:transparent">
          ${fmt(c.avgScore100)} / 100
        </div>
        <div style="color:var(--muted2);font-size:12px;margin-top:6px">${Number(c.scoresCount||0)} avaliação(ões)</div>
      </div>
    `).join("") +
    `<div class="card" style="padding:16px;margin-top:12px">
      <b>Lista completa</b>
      ${cands.map((c,idx)=>`
        <div style="display:flex;gap:12px;align-items:center;padding:10px 0;border-top:1px solid rgba(255,255,255,.08)">
          <div style="width:54px;opacity:.85">#${idx+1}</div>
          <img src="${c?.photo?.ucUrl || ""}" style="width:44px;height:44px;border-radius:16px;object-fit:cover;border:1px solid rgba(255,255,255,.10)"/>
          <div style="flex:1">
            <div style="font-weight:900">${c.nomeArtistico || c.nome}</div>
            <div style="color:var(--muted2);font-size:12px">${c.genero || "—"} • ${c.cidade || ""}</div>
          </div>
          <div style="font-weight:950">${fmt(c.avgScore100)}</div>
        </div>
      `).join("")}
    </div>`;
})();
