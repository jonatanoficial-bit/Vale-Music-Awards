/* assets/js/ranking.js
 * Ranking — consome Apps Script (?action=ranking)
 * Robusto para chaves diferentes de foto e com fallback caso a imagem falhe.
 */

(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  const els = {
    list: $("#list"),
    status: $("#status"),
    btnRefresh: $("#btnRefresh"),
    lastUpdate: $("#lastUpdate"),
  };

  function getConfig() {
    const cfg = (window.VMA_CONFIG || {});
    const url = String(cfg.APPS_SCRIPT_URL || "").trim();
    if (!url) throw new Error("Config não carregou: verifique assets/js/vma-config.js no HTML.");
    return { APPS_SCRIPT_URL: url.replace(/\/$/, "") };
  }

  function nowText() {
    try {
      return new Date().toLocaleString("pt-BR");
    } catch {
      return String(new Date());
    }
  }

  function setStatus(html, kind) {
    // kind: "ok" | "bad" | ""
    const clsOk = "statusOk";
    const clsBad = "statusBad";
    els.status.classList.remove(clsOk, clsBad);
    if (kind === "ok") els.status.classList.add(clsOk);
    if (kind === "bad") els.status.classList.add(clsBad);

    els.status.firstElementChild
      ? (els.status.firstElementChild.innerHTML = html)
      : (els.status.innerHTML = `<span>${html}</span><span class="mutedSmall" id="lastUpdate"></span>`);

    if (els.lastUpdate) els.lastUpdate.textContent = `Atualizado: ${nowText()}`;
  }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function initials(name) {
    const n = String(name || "").trim();
    if (!n) return "VA";
    const parts = n.split(/\s+/).filter(Boolean);
    const a = (parts[0] || "").slice(0, 1);
    const b = (parts.length > 1 ? parts[parts.length - 1] : parts[0]).slice(0, 1);
    return (a + b).toUpperCase();
  }

  function pickPhotoUrl(item) {
    // Aceita várias chaves possíveis
    const candidates = [
      item.photoUrl,
      item.photoPublicUrl,
      item.photo_public_url,
      item.photo,
      item.foto,
      item.fotoUrl,
      item.fotoPublicUrl,
    ].map((v) => String(v || "").trim()).filter(Boolean);

    if (!candidates.length) return "";

    // Preferir links do Drive "uc?"
    const driveUc = candidates.find((u) => u.includes("drive.google.com/uc?"));
    return driveUc || candidates[0];
  }

  function normalizeScore(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return 0;
    // Ranking no seu Apps Script já retorna 0..100, mas garantimos
    return Math.max(0, Math.min(100, v));
  }

  function renderRanking(list) {
    if (!Array.isArray(list) || !list.length) {
      els.list.innerHTML = "";
      setStatus("Nenhum candidato no ranking ainda.", "");
      return;
    }

    const html = list.map((c) => {
      const pos = Number(c.position || 0) || 0;
      const id = esc(c.candidateId || "");
      const name = esc(c.artisticName || c.name || "");
      const score = normalizeScore(c.avgScore100);
      const scoreText = score.toFixed(2);
      const count = Number(c.scoresCount || 0) || 0;

      const photo = pickPhotoUrl(c);
      const ini = initials(c.artisticName || c.name || "");

      return `
        <article class="card">
          <div class="rankBadge">${pos || ""}</div>

          <div class="avatar" aria-label="Foto do candidato">
            ${photo
              ? `<img
                    src="${esc(photo)}"
                    alt="Foto de ${name}"
                    loading="lazy"
                    referrerpolicy="no-referrer"
                    onerror="this.remove(); this.parentNode.innerHTML='<div class=\\'avatarFallback\\'>${esc(ini)}</div>';"
                 />`
              : `<div class="avatarFallback">${esc(ini)}</div>`
            }
          </div>

          <div class="info">
            <p class="name">${name || "Candidato"}</p>
            <div class="meta">
              <span class="tag">ID: ${id}</span>
              <span class="tag">${count} avaliação(ões)</span>
            </div>
          </div>

          <div class="scoreBox" aria-label="Pontuação">
            <p class="score">${scoreText}</p>
            <p class="scoreSub">/100</p>
          </div>
        </article>
      `;
    }).join("");

    els.list.innerHTML = html;
    setStatus(`✅ Ranking carregado • <strong>${list.length}</strong> candidato(s)`, "ok");
  }

  async function fetchRanking() {
    const { APPS_SCRIPT_URL } = getConfig();
    const url = `${APPS_SCRIPT_URL}?action=ranking&t=${Date.now()}`;

    setStatus("Carregando ranking...", "");
    try {
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (!data || data.ok !== true) {
        throw new Error(data && data.error ? data.error : "Resposta inválida do Apps Script");
      }

      // Esperado: { ok:true, ranking:[...] }
      const ranking = Array.isArray(data.ranking) ? data.ranking : [];
      renderRanking(ranking);
    } catch (err) {
      console.error(err);
      els.list.innerHTML = "";
      setStatus(`❌ Erro ao carregar ranking: <strong>${esc(err.message || err)}</strong>`, "bad");
    }
  }

  function bind() {
    if (els.btnRefresh) {
      els.btnRefresh.addEventListener("click", fetchRanking);
    }
  }

  // init
  bind();
  fetchRanking();
})();