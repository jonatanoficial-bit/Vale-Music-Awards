// assets/js/ranking.js
// Vale Music Awards — Ranking (consome Apps Script ?action=ranking)
// FIX DEFINITIVO: Foto via thumbnail do Drive (igual jurados.js)

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

  function q(sel){ return document.querySelector(sel); }

  function setStatus(msg, type="info"){
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

  function safeText(v){
    return String(v ?? "").replace(/[<>&"]/g, (c) => ({
      "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;"
    }[c]));
  }

  function buildUrl(params){
    const u = new URL(APPS_SCRIPT_URL);
    Object.entries(params).forEach(([k,v]) => u.searchParams.set(k, String(v)));
    u.searchParams.set("_ts", String(Date.now()));
    return u.toString();
  }

  async function fetchJson(url){
    const res = await fetch(url, { method:"GET", cache:"no-store" });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${res.statusText} - ${txt.slice(0,180)}`);
    }
    return res.json();
  }

  function extractDriveFileId(text){
    const s = String(text || "").trim();
    if (!s) return "";

    // uc?id=FILEID
    let m = s.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
    if (m && m[1]) return m[1];

    // /file/d/FILEID/
    m = s.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
    if (m && m[1]) return m[1];

    // /d/FILEID
    m = s.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
    if (m && m[1]) return m[1];

    return "";
  }

  function drivePhotoThumbUrl(fileId, size=400){
    if (!fileId) return "";
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${size}`;
  }

  function render(list, updatedAt){
    if (!el.list) return;

    if (!Array.isArray(list) || list.length === 0) {
      el.list.innerHTML = "";
      setStatus("Ainda não há candidatos no ranking. (Envie inscrições e aguarde.)", "warn");
      return;
    }

    const html = list.map(item => {
      const pos = Number(item.position || 0) || 0;
      const candidateId = safeText(item.candidateId || "");
      const name = safeText(item.artisticName || "Candidato");
      const avg = Number(item.avgScore100 || 0);
      const cnt = Number(item.scoresCount || 0);

      const photoId = extractDriveFileId(item.photoUrl);
      const photoSrc = photoId ? drivePhotoThumbUrl(photoId, 500) : "";

      return `
        <div class="item">
          <div class="left">
            <div class="pos">${pos || "-"}</div>

            <div class="photo">
              ${
                photoSrc
                  ? `<img src="${safeText(photoSrc)}" alt="Foto de ${name}" loading="lazy"
                       onerror="this.style.opacity='0.25'; this.alt='Foto indisponível';">`
                  : `<div class="photoPh">Foto</div>`
              }
            </div>

            <div class="meta">
              <div class="name">${name}</div>
              <div class="mini">
                <span class="pill">ID: ${candidateId}</span>
                <span class="pill">${cnt} avaliação(ões)</span>
              </div>
            </div>
          </div>

          <div class="scoreBox">
            <div class="score">${avg.toFixed(2)}</div>
            <div class="scoreSub">/100</div>
          </div>
        </div>
      `;
    }).join("");

    el.list.innerHTML = html;

    const dt = updatedAt ? new Date(updatedAt) : new Date();
    const stamp = `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()}, ${String(dt.getHours()).padStart(2,"0")}:${String(dt.getMinutes()).padStart(2,"0")}:${String(dt.getSeconds()).padStart(2,"0")}`;

    setStatus(`Ranking carregado • ${list.length} candidato(s) • Atualizado: ${stamp}`, "ok");
  }

  async function load(){
    try {
      setStatus("Carregando ranking...", "info");
      const url = buildUrl({ action:"ranking" });
      const data = await fetchJson(url);

      if (!data || data.ok !== true) throw new Error(data?.error || "Resposta inválida da API.");

      render(data.ranking || [], data.updatedAt || null);
    } catch (err) {
      console.error(err);
      setStatus(`Falha ao carregar ranking: ${err.message}`, "err");
      if (el.list) el.list.innerHTML = "";
    }
  }

  function init(){
    el.status = q("#statusBox");
    el.list = q("#rankingList");
    el.btn = q("#btnRefresh");

    if (el.btn) el.btn.addEventListener("click", () => load());
    load();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
