// assets/js/jurados.js
// Vale Music Awards - Área de Jurados (Forms + Apps Script API)
// - Carrega candidatos via Apps Script (?action=candidates)
// - Envia avaliação travada via Apps Script (?action=rate)
// - Soma automática 0..100 (10 critérios de 0..10)
// - Travamento no front após enviar + bloqueio no backend (ALREADY_RATED)
// - FIX: Foto via thumbnail do Drive + Áudio via iframe /preview (Drive Player)
// - UX: Foto pequena, proporcional e elegante
//
// ✅ FIX CRÍTICO: Botão "Finalizar avaliação" agora é type="button"
// (se a página tiver <form>, o default é submit e pode recarregar/impedir o JS)

(() => {
  "use strict";

  /* =========================
     CONFIG
  ========================= */

  const CFG = (typeof window !== "undefined" && window.VMA_CONFIG) ? window.VMA_CONFIG : {};

  const APPS_SCRIPT_URL =
    CFG.APPS_SCRIPT_URL ||
    "https://script.google.com/macros/s/AKfycbxRvwp0aOtgENIj6Hm0H_zb0IsDBzW-QM6BB7_eNKDzp5tSFVMgucItzidnKofVfKHw/exec";

  // ✅ Compatível com seu vma-config.js (SECRET)
  const API_SECRET =
    CFG.SECRET ||
    CFG.API_SECRET ||
    "VMA-2026-VALE-SEGREDO-9137";

  const CRITERIA = [
    { key: "afinacao", label: "Afinação", desc: "Precisão das notas, estabilidade e controle." },
    { key: "ritmo", label: "Ritmo & Tempo", desc: "Pulsação, entradas/saídas e regularidade." },
    { key: "interpretacao", label: "Interpretação", desc: "Expressão, intenção e emoção musical." },
    { key: "dicao", label: "Pronúncia & Dicção", desc: "Clareza das palavras e articulação." },
    { key: "timbre", label: "Timbre", desc: "Qualidade, identidade e beleza vocal." },
    { key: "controle", label: "Controle Vocal", desc: "Apoio, respiração, sustentação e afinação em dinâmica." },
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
    el.status = q("#statusBox") || q(".status-box") || q("[data-status]");
    el.list = q("#candidatesList") || q("#candidates") || q("[data-candidates]");
    el.jurorInput = q("#jurorId") || q("input[name='jurorId']") || q("[data-juror]");
    el.btnSaveJuror = q("#saveJuror") || q("[data-save-juror]");
    el.btnRefresh = q("#refreshCandidates") || q("[data-refresh]");
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

  // Foto está lembrar e estável
  function drivePhotoThumbUrl(fileId, size = 500) {
    if (!fileId) return "";
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${size}`;
  }

  // Áudio definitivo
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
      setStatus("Não encontrei o container de candidatos no HTML (IDs esperados: #candidatesList ou #candidates).", "err");
      return;
    }

    if (!Array.isArray(candidates) || candidates.length === 0) {
      el.list.innerHTML = "";
      setStatus("Nenhum candidato encontrado ainda. (Se você acabou de enviar no Forms, aguarde ~10s e clique em Atualizar.)", "warn");
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
        <div class="crit-row">
          <div class="crit-head">
            <div class="crit-title">${safeText(cr.label)}</div>
            <div class="crit-val"><span data-val-for="${safeText(cr.key)}">0</span></div>
          </div>
          <div class="crit-desc">${safeText(cr.desc)}</div>
          <div class="crit-slider">
            <input type="range" min="0" max="10" value="0" step="1"
              data-crit="${safeText(cr.key)}" aria-label="${safeText(cr.label)}">
            <div class="crit-badge"><span data-badge-for="${safeText(cr.key)}">0</span></div>
          </div>
        </div>
      `).join("");

      return `
        <section class="candidate-card" data-candidate="${id}">
          <div class="cand-top" style="display:flex; gap:14px; align-items:flex-start;">
            
            <div class="cand-photo" style="
              width:86px; height:86px; border-radius:18px; overflow:hidden;
              background: rgba(255,255,255,0.06);
              border: 1px solid rgba(255,255,255,0.10);
              box-shadow: 0 10px 30px rgba(0,0,0,0.35);
              flex: 0 0 auto;
            ">
              ${
                photoSrc
                  ? `<img src="${safeText(photoSrc)}" alt="Foto de ${name}" loading="lazy"
                       style="width:100%;height:100%;object-fit:cover;object-position:center;display:block;"
                       onerror="this.style.opacity='0.25'; this.alt='Foto indisponível';">`
                  : `<div class="photo-fallback" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;opacity:0.7;">Sem foto</div>`
              }
            </div>

            <div class="cand-meta" style="flex:1; min-width:0;">
              <div class="cand-name" style="font-weight:700; font-size:18px; line-height:1.2;">
                ${name}
              </div>

              <div class="cand-tags" style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
                <span class="tag">ID: ${id}</span>
                ${genre ? `<span class="tag">${genre}</span>` : ""}
                ${city ? `<span class="tag">${city}</span>` : ""}
              </div>

              <div class="cand-audio" style="margin-top:12px;">
                ${
                  audioPreview
                    ? `
                      <div class="audio-embed" style="
                        width:100%;
                        border-radius:16px;
                        overflow:hidden;
                        border:1px solid rgba(255,255,255,0.10);
                        background: rgba(0,0,0,0.35);
                        box-shadow: 0 12px 28px rgba(0,0,0,0.35);
                      ">
                        <iframe
                          src="${safeText(audioPreview)}"
                          allow="autoplay"
                          loading="lazy"
                          title="Player de áudio - ${name}"
                          style="width:100%;height:110px;border:0;display:block;">
                        </iframe>
                      </div>
                      <a class="audio-open" href="${safeText(audioPreview)}" target="_blank" rel="noopener"
                        style="display:inline-block;margin-top:10px;opacity:0.9;text-decoration:none;">
                        Abrir áudio
                      </a>
                    `
                    : `<div class="audio-fallback" style="opacity:0.75;">Sem áudio</div>`
                }
              </div>
            </div>

            <div class="cand-total" style="flex:0 0 auto;">
              <div class="total-box">
                <div class="total-label">TOTAL</div>
                <div class="total-num"><span data-total>0</span></div>
                <div class="total-sub">/ 100</div>
              </div>
            </div>

          </div>

          <div class="cand-criteria">
            <div class="criteria-title">Avaliação Técnica</div>
            <div class="criteria-sub">A nota final (0–100) é calculada automaticamente pela soma dos critérios.</div>
            ${critBlocks}
          </div>

          <div class="cand-actions">
            <button type="button" class="btn-primary" data-action="submit">Finalizar avaliação</button>
            <div class="lock-hint" data-lockhint></div>
          </div>
        </section>
      `;
    }).join("");

    el.list.innerHTML = html;

    [...el.list.querySelectorAll(".candidate-card")].forEach(card => {
      const candidateId = card.dataset.candidate;
      const jurorIdNow = getJurorId();
      const locked = jurorIdNow && candidateId ? isLocked(jurorIdNow, candidateId) : false;

      card.querySelectorAll("input[type='range'][data-crit]").forEach(r => {
        r.addEventListener("input", () => {
          const key = r.dataset.crit;
          const v = Number(r.value || 0);
          const vEl = card.querySelector(`[data-val-for="${CSS.escape(key)}"]`);
          const bEl = card.querySelector(`[data-badge-for="${CSS.escape(key)}"]`);
          if (vEl) vEl.textContent = String(v);
          if (bEl) bEl.textContent = String(v);
          computeTotal(card);
        });
      });

      computeTotal(card);

      const btn = card.querySelector('button[data-action="submit"]');
      if (btn) {
        btn.addEventListener("click", async (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          await submitRating(card);
        });
      }

      const lockHint = card.querySelector("[data-lockhint]");
      if (locked) {
        if (lockHint) lockHint.textContent = "Avaliação já enviada por este jurado (travada).";
        disableCard(card, true);
      } else {
        if (lockHint) lockHint.textContent = "";
      }
    });

    setStatus(`${candidates.length} candidato(s) carregado(s).`, "ok");
  }

  /* =========================
     API ACTIONS
  ========================= */

  async function loadCandidates() {
    try {
      setStatus("Carregando candidatos...", "info");
      const url = buildUrl({ action: "candidates" });
      const data = await fetchJson(url);

      if (!data || data.ok !== true) {
        throw new Error(data?.error || "Resposta inválida da API.");
      }

      const candidates = data.candidates || [];
      renderCandidates(candidates);
    } catch (err) {
      console.error(err);
      setStatus(`Falha ao carregar candidatos: ${err.message}`, "err");
      if (el.list) el.list.innerHTML = "";
    }
  }

  async function submitRating(cardEl) {
    const jurorId = getJurorId();
    const candidateId = cardEl.dataset.candidate;

    if (!jurorId) {
      setStatus("Defina seu ID de jurado (ex.: J1) antes de avaliar.", "warn");
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

    const sliders = CRITERIA.map(cr => {
      const r = cardEl.querySelector(`input[type="range"][data-crit="${CSS.escape(cr.key)}"]`);
      return r ? Number(r.value || 0) : 0;
    });

    for (const n of sliders) {
      if (!Number.isFinite(n) || n < 0 || n > 10) {
        setStatus("Notas inválidas. Use valores de 0 a 10.", "err");
        return;
      }
    }

    const total = sliders.reduce((a, b) => a + b, 0);

    const confirmMsg =
      `Confirmar envio?\n\n` +
      `Jurado: ${jurorId}\n` +
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
        scores: sliders.join(",")
      });

      const data = await fetchJson(url);

      if (!data || data.ok !== true) {
        disableCard(cardEl, false);
        const msg = data?.error || "Falha ao salvar nota.";
        if (msg === "ALREADY_RATED") {
          setLock(jurorId, candidateId);
          disableCard(cardEl, true);
          setStatus("Você já avaliou este candidato. (Travado)", "warn");
          return;
        }
        throw new Error(msg);
      }

      setLock(jurorId, candidateId);

      const lockHint = cardEl.querySelector("[data-lockhint]");
      if (lockHint) lockHint.textContent = "Avaliação enviada e travada.";

      setStatus(`Avaliação enviada! Total: ${data.total100}/100 — Ranking atualizado.`, "ok");

      await sleep(600);

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
    if (saved && el.jurorInput && !el.jurorInput.value) {
      el.jurorInput.value = saved;
    }

    if (el.btnSaveJuror) {
      el.btnSaveJuror.addEventListener("click", (ev) => {
        ev.preventDefault();
        const id = getJurorId();
        if (!id) {
          setStatus("Digite seu ID de jurado (ex.: J1).", "warn");
          return;
        }
        setJurorId(id);
        setStatus(`Jurado definido: ${id}`, "ok");
        loadCandidates();
      });
    }

    if (el.btnRefresh) {
      el.btnRefresh.addEventListener("click", (ev) => {
        ev.preventDefault();
        loadCandidates();
      });
    }

    loadCandidates();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
