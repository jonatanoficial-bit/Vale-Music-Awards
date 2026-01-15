// assets/js/ranking.js
// Vale Music Awards - Ranking (Apps Script API)
// - Carrega ranking via ?action=ranking
// - Renderiza foto com thumbnail do Drive (hotlink estável)
// - Evita duplicar cards ao atualizar

(() => {
  "use strict";

  const CFG = (typeof window !== "undefined" && window.VMA_CONFIG) ? window.VMA_CONFIG : {};

  const APPS_SCRIPT_URL =
    CFG.APPS_SCRIPT_URL ||
    "https://script.google.com/macros/s/AKfycbxRvwp0aOtgENIj6Hm0H_zb0IsDBzW-QM6BB7_eNKDzp5tSFVMgucItzidnKofVfKHw/exec";

  const el = {
    status: null,
    list: null,
    btn: null
  };

  function q(sel) { return document.querySelector(sel); }

  function bindDom() {
    el.status = q("#rankingStatus") || q("#statusBox") || q("[data-ranking-status]");
    el.list = q("#rankingList") || q("#ranking") || q("[data-ranking]");
    el.btn = q("#refreshRanking") || q("[data-refresh-ranking]");
  }

  function setStatus(msg, type = "info") {
    const prefix =
      type === "ok" ? "✅ " :
      type === "warn" ? "⚠️ " :
      type === "err" ? "❌ " : "ℹ️ ";

    if (el.status) {
      el.status.textContent = prefix + msg;
      el.status.dataset.type = type;
    } else {
      console[type === "err" ? "error" : "log"](prefix + msg);
    }
  }

  function buildUrl(params) {
    const u = new URL(APPS_SCRIPT_URL);
    Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, String(v)));
    u.searchParams.set("_ts", String(Date.now()));
    return u.toString();
  }

  async function fetchJson(url) {
    const res = await fetch(url, { method: "GET", cache: "no-store" });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${res.statusText} - ${txt.slice(0, 180)}`);
    }
    return res.json();
  }

  function safeText(v) {
    return String(v ?? "").replace(/[<>&"]/g, (c) => ({
      "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;"
    }[c]));
  }

  function extractDriveFileId(text) {
    const s = String(text || "").trim();
    if (!s) return "";

    let m = s.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
    if (m && m[1]) return m[1];

    m = s.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
    if (m && m[1]) return m[1];

    m = s.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
    if (m && m[1]) return m[1];

    return "";
  }

  function drivePhotoThumbUrl(fileId, size = 500) {
    if (!fileId) return "";
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${size}`;
  }

  function renderRanking(items) {
    if (!el.list) {
      setStatus("Container do ranking não encontrado no HTML (#rankingList).", "err");
      return;
    }

    el.list.innerHTML = "";

    if (!Array.isArray(items) || items.length === 0) {
      setStatus("Ranking vazio (ainda sem avaliações).", "warn");
      return;
    }

    const html = items.map((r) => {
      const pos = Number(r.position || 0);
      const id = safeText(r.candidateId || "");
      const name = safeText(r.artisticName || "Candidato");
      const avg = Number(r.avgScore100 || 0);
      const count = Number(r.scoresCount || 0);

      const photoId = extractDriveFileId(r.photoUrl);
      const photoSrc = photoId ? drivePhotoThumbUrl(photoId, 600) : "";

      return `
        <div class="rank-row" style="
          display:flex; align-items:center; gap:12px;
          padding:14px; border-radius:18px;
          border:1px solid rgba(255,255,255,0.10);
          background: rgba(0,0,0,0.32);
          box-shadow: 0 14px 34px rgba(0,0,0,0.35);
          margin-bottom:12px;
        ">
          <div class="rank-pos" style="
            width:42px; height:42px; border-radius:14px;
            display:flex; align-items:center; justify-content:center;
            font-weight:800;
            background: rgba(212,175,55,0.12);
            border: 1px solid rgba(212,175,55,0.25);
            color: rgba(212,175,55,0.95);
            flex: 0 0 auto;
          ">${pos}</div>

          <div class="rank-photo" style="
            width:54px; height:54px; border-radius:16px; overflow:hidden;
            background: rgba(255,255,255,0.06);
            border:1px solid rgba(255,255,255,0.10);
            flex:0 0 auto;
          ">
            ${
              photoSrc
                ? `<img src="${safeText(photoSrc)}" alt="Foto ${name}" loading="lazy"
                     style="width:100%;height:100%;object-fit:cover;object-position:center;display:block;"
                     onerror="this.style.opacity='0.25'; this.alt='Foto indisponível';">`
                : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;opacity:0.7;">Foto</div>`
            }
          </div>

          <div class="rank-meta" style="flex:1; min-width:0;">
            <div style="font-weight:800; font-size:16px; line-height:1.2;">${name}</div>
            <div style="opacity:0.85; font-size:12.5px; margin-top:6px;">
              ID: ${id} • ${count} avaliação(ões)
            </div>
          </div>

          <div class="rank-score" style="
            min-width:92px;
            padding:10px 12px;
            border-radius:16px;
            text-align:right;
            background: rgba(212,175,55,0.10);
            border:1px solid rgba(212,175,55,0.22);
            color: rgba(212,175,55,0.95);
            font-weight:900;
          ">
            <div style="font-size:20px; line-height:1;">${avg.toFixed(2)}</div>
            <div style="font-size:12px; opacity:0.9;">/100</div>
          </div>
        </div>
      `;
    }).join("");

    el.list.innerHTML = html;
    setStatus(`Ranking carregado • ${items.length} candidato(s)`, "ok");
  }

  async function loadRanking() {
    try {
      setStatus("Carregando ranking...", "info");
      const url = buildUrl({ action: "ranking" });
      const data = await fetchJson(url);
      if (!data || data.ok !== true) throw new Error(data?.error || "Resposta inválida.");
      renderRanking(data.ranking || []);
    } catch (err) {
      console.error(err);
      setStatus(`Falha ao carregar ranking: ${err.message}`, "err");
      if (el.list) el.list.innerHTML = "";
    }
  }

  function init() {
    bindDom();
    if (el.btn) el.btn.addEventListener("click", loadRanking);
    loadRanking();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();