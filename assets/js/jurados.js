// assets/js/jurados.js
// Vale Music Awards - Área de Jurados (Forms + Apps Script API)
// FIX: compatível com IDs do seu jurados.html (jurorIdInput/saveJurorIdBtn/refreshBtn/statusBar/candidatesList)
// Mantém a MESMA lógica estável de foto (thumbnail) e áudio (Drive preview)

(() => {
  "use strict";

  /* =========================
     CONFIG
  ========================= */

  const CFG = (typeof window !== "undefined" && window.VMA_CONFIG) ? window.VMA_CONFIG : {};

  const APPS_SCRIPT_URL =
    CFG.APPS_SCRIPT_URL ||
    "https://script.google.com/macros/s/AKfycbxRvwp0aOtgENIj6Hm0H_zb0IsDBzW-QM6BB7_eNKDzp5tSFVMgucItzidnKofVfKHw/exec";

  // no seu vma-config.js você usa "SECRET"
  const API_SECRET =
    CFG.SECRET ||
    CFG.API_SECRET ||
    "VMA-2026-VALE-SEGREDO-9137";

  // critérios (0..10) somando 0..100
  const CRITERIA =
    (Array.isArray(CFG.CRITERIA) && CFG.CRITERIA.length)
      ? CFG.CRITERIA.map(c => ({ key: c.key, label: c.label, desc: c.hint || c.desc || "" }))
      : [
          { key: "afinacao", label: "Afinação", desc: "Precisão das notas, estabilidade e controle." },
          { key: "ritmo", label: "Ritmo & Tempo", desc: "Pulsação, entradas/saídas e regularidade." },
          { key: "interpretacao", label: "Interpretação", desc: "Expressão, intenção e emoção musical." },
          { key: "dicao", label: "Pronúncia & Dicção", desc: "Clareza das palavras e articulação." },
          { key: "timbre", label: "Timbre", desc: "Qualidade, identidade e beleza vocal." },
          { key: "controle", label: "Controle Vocal", desc: "Apoio, respiração, sustentação e estabilidade técnica." },
          { key: "dinamica", label: "Dinâmica", desc: "Variações de intensidade com musicalidade." },
          { key: "extensao", label: "Extensão", desc: "Alcance vocal e transições entre registros." },
          { key: "musicalidade", label: "Musicalidade", desc: "Fraseado, nuances e encaixe com a base." },
          { key: "potencial", label: "Potencial Artístico", desc: "Presença, originalidade e projeção comercial." }
        ];

  const STORAGE_KEY = "VMA_JUROR_ID";
  const LOCKS_KEY = "VMA_RATED_LOCKS"; // mapa local { "J1::VMA-0001": true }

  /* =========================
     DOM
  ========================= */

  const el = {
    status: null,
    list: null,
    jurorInput: null,
    btnSaveJuror: null,
    btnRefresh: null
  };

  function q(sel) { return document.querySelector(sel); }

  function bindDom() {
    // ✅ IDs do seu HTML (jurados (1).html)
    el.status = q("#statusBar") || q("#statusBox") || q(".status-box") || q("[data-status]");
    el.list = q("#candidatesList") || q("#candidates") || q("[data-candidates]");
    el.jurorInput = q("#jurorIdInput") || q("#jurorId") || q("input[name='jurorId']") || q("[data-juror]");
    el.btnSaveJuror = q("#saveJurorIdBtn") || q("#saveJuror") || q("[data-save-juror]");
    el.btnRefresh = q("#refreshBtn") || q("#refreshCandidates") || q("[data-refresh]");
  }

  function setStatus(msg, type = "info") {
    const prefix =
      type === "ok" ? "✅ " :
      type === "warn" ? "⚠️ " :
      type === "err" ? "❌ " : "ℹ️ ";

    if (el.status) {
      el.status.textContent = prefix + msg;

      // compatível com seu statusBar
      if (el.status.id === "statusBar") el.status.dataset.kind = type;

      // compatível com outros layouts
      el.status.dataset.type = type;
    } else {
      console[type === "err" ? "error" : "log"](prefix + msg);
    }
  }

  /* =========================
     HELPERS
  ========================= */

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function safeText(v) {
    return String(v ?? "").replace(/[<>&"]/g, (c) => ({
      "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;"
    }[c]));
  }

  function getJurorId() {
    const saved = localStorage.getItem(STORAGE_KEY);
    const val = (el.jurorInput && el.jurorInput.value) ? el.jurorInput.value : saved;
    return String(val || "").trim();
  }

  function setJurorId(id) {
    localStorage.setItem(STORAGE_KEY, id);
    if (el.jurorInput) el.jurorInput.value = id;
  }

  function getLocks() {
    try { return JSON.parse(localStorage.getItem(LOCKS_KEY) || "{}"); }
    catch { return {}; }
  }

  function setLock(jurorId, candidateId) {
    const locks = getLocks();
    locks[`${jurorId}::${candidateId}`] = true;
    localStorage.setItem(LOCKS_KEY, JSON.stringify(locks));
  }

  function isLocked(jurorId, candidateId) {
    const locks = getLocks();
    return !!locks[`${jurorId}::${candidateId}`];
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

  // ✅ Foto estável (thumbnail)
  function drivePhotoThumbUrl(fileId, size = 500) {
    if (!fileId) return "";
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${size}`;
  }

  // ✅ Áudio estável (preview player)
  function drivePreviewUrl(fileId) {
    if (!fileId) return "";
    return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
  }

  function computeTotal(cardEl) {
    const sliders = [...cardEl.querySelectorAll("input[type='range'][data-crit]")];
    const sum = sliders.reduce((acc, s) => acc + Number(s.value || 0), 0);
    const totalEl = cardEl.querySelector("[data-total]");
    if (totalEl) totalEl.textContent = String(sum);
    return sum;
  }

  function disableCard(cardEl, disabled = true) {
    const inputs = cardEl.querySelectorAll("input, button, select, textarea");
    inputs.forEach(i => {
      if (i.dataset.allow !== "1") i.disabled = disabled;
    });
  }

  /* =========================
     RENDER
  ========================= */

  function renderCandidates(candidates) {
    if (!el.list) {
      setStatus("Não encontrei o container de candidatos no HTML (#candidatesList).", "err");
      return;
    }

    if (!Array.isArray(candidates) || candidates.length === 0) {
      el.list.innerHTML = `<div class="emptyState">Nenhum candidato encontrado ainda. Se acabou de enviar no Forms, aguarde ~10s e clique em Atualizar.</div>`;
      setStatus("Nenhum candidato encontrado ainda.", "warn");
      return;
    }

    const jurorId = getJurorId();

    const html = candidates.map(c => {
      const id = safeText(c.candidateId || "");
      const name = safeText(c.artisticName || c.name || "Candidato");
      const city = safeText(c.city || "");
      const genre = safeText(c.genre || "");

      const photoId = extractDriveFileId(c.photoUrl);
      const audioId = extractDriveFileId(c.audioUrl);

      const photoSrc = photoId ? drivePhotoThumbUrl(photoId, 700) : "";
      const audioPreview = audioId ? drivePreviewUrl(audioId) : "";

      const locked = jurorId && id ? isLocked(jurorId, id) : false;

      const critBlocks = CRITERIA.map(cr => `
        <div class="critRow">
          <div class="critLeft">
            <div class="critLabel">${safeText(cr.label)}</div>
            <div class="critHint">${safeText(cr.desc || "")}</div>
          </div>
          <div class="critRight">
            <input class="critRange" type="range" min="0" max="10" value="0" step="1" data-crit="${safeText(cr.key)}">
            <div class="critValue" data-badge-for="${safeText(cr.key)}">0</div>
          </div>
        </div>
      `).join("");

      return `
        <div class="candCard" data-candidate="${id}">
          <div class="candTop">
            <div class="candPhoto">
              ${
                photoSrc
                  ? `<img src="${safeText(photoSrc)}" alt="Foto de ${name}" loading="lazy"
                       onerror="this.style.opacity='0.25';">`
                  : `<div class="photoPh">Sem foto</div>`
              }
            </div>

            <div class="candInfo">
              <div class="candName">${name}</div>
              <div class="candMeta">
                <span class="tag">ID: ${id}</span>
                ${genre ? `<span class="tag">${genre}</span>` : ""}
                ${city ? `<span class="tag">${city}</span>` : ""}
              </div>

              <div class="audioWrap">
                ${
                  audioPreview
                    ? `
                      <div style="border-radius:16px; overflow:hidden; border:1px solid rgba(255,255,255,.10); background:rgba(0,0,0,.25);">
                        <iframe
                          src="${safeText(audioPreview)}"
                          allow="autoplay"
                          loading="lazy"
                          title="Player de áudio - ${name}"
                          style="width:100%;height:110px;border:0;display:block;">
                        </iframe>
                      </div>
                      <a href="${safeText(audioPreview)}" target="_blank" rel="noopener" style="display:inline-block;margin-top:10px;color:#e9e9ef;opacity:.85;text-decoration:none;">
                        Abrir áudio
                      </a>
                    `
                    : `<div style="opacity:.75;">Sem áudio</div>`
                }
              </div>
            </div>
          </div>

          <div class="candBody">
            <div class="critHeader">
              <div>
                <div class="critTitle">Avaliação Técnica</div>
                <div class="critSub">A nota final (0–100) é calculada automaticamente pela soma dos critérios.</div>
              </div>
              <div class="totalBox">
                <div class="totalLabel">TOTAL</div>
                <div class="totalValue"><span data-total>0</span></div>
                <div class="totalMax">/ 100</div>
              </div>
            </div>

            <div class="criteriaList">
              ${critBlocks}
            </div>

            <div class="actions">
              <button class="btnPrimary" data-action="submit">Finalizar avaliação</button>
              <div class="smallNote" data-lockhint></div>
            </div>
          </div>

          <div class="lockedOverlay" data-locked>
            <div class="lockedBox">
              <div class="lockedTitle">Avaliação travada</div>
              <div class="lockedMsg">Você já enviou a avaliação deste candidato com este jurado.</div>
            </div>
          </div>
        </div>
      `;
    }).join("");

    el.list.innerHTML = html;

    [...el.list.querySelectorAll(".candCard")].forEach(card => {
      const candidateId = card.dataset.candidate;
      const jurorIdNow = getJurorId();
      const locked = jurorIdNow && candidateId ? isLocked(jurorIdNow, candidateId) : false;

      card.querySelectorAll("input[type='range'][data-crit]").forEach(r => {
        r.addEventListener("input", () => {
          const key = r.dataset.crit;
          const v = Number(r.value || 0);
          const badge = card.querySelector(`[data-badge-for="${CSS.escape(key)}"]`);
          if (badge) badge.textContent = String(v);
          computeTotal(card);
        });
      });

      computeTotal(card);

      const btn = card.querySelector('button[data-action="submit"]');
      if (btn) btn.addEventListener("click", async () => submitRating(card));

      const lockHint = card.querySelector("[data-lockhint]");
      const overlay = card.querySelector("[data-locked]");

      if (locked) {
        if (lockHint) lockHint.textContent = "Avaliação já enviada por este jurado (travada).";
        if (overlay) overlay.style.display = "flex";
        disableCard(card, true);
      } else {
        if (lockHint) lockHint.textContent = "Uma vez enviado, fica travado para este jurado.";
        if (overlay) overlay.style.display = "none";
      }
    });

    setStatus(`${candidates.length} candidato(s) carregado(s).`, "ok");
  }

  /* =========================
     API
  ========================= */

  async function loadCandidates() {
    try {
      setStatus("Carregando candidatos...", "info");
      const url = buildUrl({ action: "candidates" });
      const data = await fetchJson(url);

      if (!data || data.ok !== true) throw new Error(data?.error || "Resposta inválida da API.");

      renderCandidates(data.candidates || []);
    } catch (err) {
      console.error(err);
      setStatus(`Falha ao carregar candidatos: ${err.message}`, "err");
      if (el.list) el.list.innerHTML = `<div class="emptyState">Erro ao carregar candidatos.</div>`;
    }
  }

  async function submitRating(cardEl) {
    const jurorId = getJurorId();
    const candidateId = cardEl.dataset.candidate;

    if (!jurorId) {
      // Instrui o jurado a definir o seu RA antes de avaliar
      alert("Defina seu RA de jurado e clique em Salvar.");
      if (el.jurorInput) el.jurorInput.focus();
      return;
    }

    if (!candidateId) {
      setStatus("CandidateId não encontrado no card.", "err");
      return;
    }

    if (isLocked(jurorId, candidateId)) {
      setStatus("Esta avaliação já foi enviada e está travada.", "warn");
      return;
    }

    const scores = CRITERIA.map(cr => {
      const r = cardEl.querySelector(`input[type="range"][data-crit="${CSS.escape(cr.key)}"]`);
      return r ? Number(r.value || 0) : 0;
    });

    const total = scores.reduce((a, b) => a + b, 0);

    const confirmMsg =
      `Confirmar envio?\n\n` +
      `RA do jurado: ${jurorId}\n` +
      `Candidato: ${candidateId}\n` +
      `Total: ${total}/100\n\n` +
      `Após enviar, não será possível alterar.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setStatus(`Enviando avaliação (${candidateId})...`, "info");
      disableCard(cardEl, true);

      const url = buildUrl({
        action: "rate",
        secret: API_SECRET,
        jurorId,
        candidateId,
        scores: scores.join(",")
      });

      const data = await fetchJson(url);

      if (!data || data.ok !== true) {
        const msg = data?.error || "Falha ao salvar nota.";
        if (msg === "ALREADY_RATED") {
          setLock(jurorId, candidateId);
          setStatus("Você já avaliou este candidato. (Travado)", "warn");
          return;
        }
        throw new Error(msg);
      }

      setLock(jurorId, candidateId);
      setStatus(`Avaliação enviada! Total: ${data.total100}/100 — Ranking atualizado.`, "ok");

      const overlay = cardEl.querySelector("[data-locked]");
      if (overlay) overlay.style.display = "flex";

      await sleep(400);
    } catch (err) {
      console.error(err);
      setStatus(`Erro ao enviar avaliação: ${err.message}`, "err");
      disableCard(cardEl, false);
    }
  }

  /* =========================
     INIT
  ========================= */

  function init() {
    bindDom();

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && el.jurorInput && !el.jurorInput.value) el.jurorInput.value = saved;

    if (el.btnSaveJuror) {
      el.btnSaveJuror.addEventListener("click", () => {
        const id = getJurorId();
        if (!id) {
          // Mensagem caso o jurado não tenha informado seu RA
          setStatus("Digite seu RA de jurado (ex.: 12345).", "warn");
          return;
        }
        setJurorId(id);
        // Exibe confirmação com o RA do jurado salvo
        setStatus(`RA definido: ${id}`, "ok");
        loadCandidates();
      });
    }

    if (el.btnRefresh) el.btnRefresh.addEventListener("click", () => loadCandidates());

    loadCandidates();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
