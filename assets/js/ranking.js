// assets/js/ranking.js
import { VMA_API } from "./vma-api.js";

const listEl = document.getElementById("rankList");
const statusEl = document.getElementById("rankStatus");

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (m) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function card(item) {
  const name = item.artisticName || item.candidateId;
  const photo = item.photoUrl || "../assets/img/vale-producao-logo.png";
  const score = Number(item.avgScore100 || 0).toFixed(2);
  const count = Number(item.scoresCount || 0);
  return `
    <div class="rank-card">
      <div class="pos">#${item.position}</div>
      <div class="meta">
        <img src="${esc(photo)}" alt="${esc(name)}" loading="lazy" />
        <div>
          <div class="name">${esc(name)}</div>
          <div class="sub muted">${esc(item.candidateId)} • ${count} avaliação(ões)</div>
        </div>
      </div>
      <div class="score">
        <strong>${esc(score)}</strong>
        <span class="pill">0–100</span>
      </div>
    </div>
  `;
}

async function load() {
  try {
    statusEl.textContent = "Atualizando…";
    const data = await VMA_API.ranking();
    const rank = data.ranking || [];
    if (!rank.length) {
      listEl.innerHTML = `<div class="loading">Ranking será exibido após as primeiras avaliações.</div>`;
      statusEl.textContent = "Pronto";
      return;
    }
    listEl.innerHTML = rank.map(card).join("");
    statusEl.textContent = "Pronto";
  } catch (e) {
    listEl.innerHTML = `<div class="loading">Erro ao carregar ranking: ${esc(e.message)}</div>`;
    statusEl.textContent = "Erro";
  }
}

// Atualiza a cada 10s
load();
setInterval(load, 10000);
