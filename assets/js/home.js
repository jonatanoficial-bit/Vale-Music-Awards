// assets/js/home.js
import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

function fmt(n){
  const x = Number(n || 0);
  return x.toFixed(2);
}

function escapeHtml(s){
  return String(s || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

async function loadTop3(){
  const q = query(collection(db, "candidates"), orderBy("avgScore100","desc"), limit(3));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}

(function(){
  const list = document.getElementById("rankMiniList");
  const status = document.getElementById("rankStatus");
  if(!list || !status) return;

  (async ()=>{
    try{
      status.textContent = "atualizando...";
      const top3 = await loadTop3();

      if(!top3.length){
        list.innerHTML = `
          <div class="rankRow">
            <div class="rankRow__n">•</div>
            <div class="rankRow__name">Ranking será exibido após as primeiras avaliações.</div>
            <div class="rankRow__score">—</div>
          </div>
        `;
        status.textContent = "pronto";
        return;
      }

      list.innerHTML = top3.map((c, idx) => `
        <div class="rankRow">
          <div class="rankRow__n">#${idx+1}</div>
          <div class="rankRow__name">${escapeHtml(c.nomeArtistico || c.nome)}</div>
          <div class="rankRow__score">${fmt(c.avgScore100)}</div>
        </div>
      `).join("");

      status.textContent = "pronto";
    }catch(e){
      console.error("[VMA] home ranking error:", e);
      status.textContent = "erro";
      list.innerHTML = `
        <div class="rankRow">
          <div class="rankRow__n">!</div>
          <div class="rankRow__name">Não foi possível carregar o ranking agora.</div>
          <div class="rankRow__score">—</div>
        </div>
      `;
    }
  })();
})();