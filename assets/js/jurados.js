/* assets/js/jurados.js
   Vale Music Awards — Jurados (Drive + Apps Script)
   - Carrega candidatos via ?action=candidates
   - Envia notas via ?action=rate (GET)
   - Drive robusto: normaliza URL de foto e áudio (evita 0:00 e imagem quebrada)
*/

(() => {
  "use strict";

  const CFG = window.VMA_CONFIG || {};
  const APPS = (CFG.APPS_SCRIPT_URL || "").trim();
  const SECRET = (CFG.SECRET || "").trim();
  const CRITERIA = Array.isArray(CFG.CRITERIA) ? CFG.CRITERIA : [];

  const CONFIG = {
    jurorInputId: "jurorIdInput",
    saveJurorBtnId: "saveJurorBtn",
    refreshBtnId: "refreshCandidatesBtn",
    statusId: "statusBox",
    gridId: "candidatesGrid",
    storageJurorKey: "VMA_JUROR_ID",
    storageRatedPrefix: "VMA_RATED_" // + jurorId -> JSON map
  };

  // ---------------------------
  // Helpers: DOM
  // ---------------------------
  const $ = (id) => document.getElementById(id);

  function setStatus(type, msg) {
    const el = $(CONFIG.statusId);
    if (!el) return;
    el.dataset.type = type || "info";
    el.textContent = msg || "";
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function toNumberSafe(n, fallback = 0) {
    const x = Number(n);
    return Number.isFinite(x) ? x : fallback;
  }

  // ---------------------------
  // Helpers: Juror ID
  // ---------------------------
  function getJurorId() {
    const el = $(CONFIG.jurorInputId);
    const typed = el ? String(el.value || "").trim() : "";
    const saved = String(localStorage.getItem(CONFIG.storageJurorKey) || "").trim();
    return typed || saved;
  }

  function saveJurorIdFromInput() {
    const el = $(CONFIG.jurorInputId);
    const v = el ? String(el.value || "").trim() : "";
    if (!v) {
      alert("Digite seu ID de jurado (ex.: J1) e clique em Salvar.");
      return null;
    }
    localStorage.setItem(CONFIG.storageJurorKey, v);
    setStatus("ok", `✅ Jurado salvo: ${v}`);
    return v;
  }

  function ensureJurorOrAlert() {
    const jurorId = getJurorId();
    if (!jurorId) {
      alert("Defina seu ID de jurado e clique em Salvar.");
      return null;
    }
    // garante input preenchido com o salvo (UX)
    const el = $(CONFIG.jurorInputId);
    if (el && !String(el.value || "").trim()) el.value = jurorId;
    return jurorId;
  }

  // ---------------------------
  // Helpers: Rated lock (local)
  // ---------------------------
  function readRatedMap(jurorId) {
    try {
      const raw = localStorage.getItem(CONFIG.storageRatedPrefix + jurorId);
      const obj = raw ? JSON.parse(raw) : {};
      return obj && typeof obj === "object" ? obj : {};
    } catch {
      return {};
    }
  }

  function markRated(jurorId, candidateId) {
    const map = readRatedMap(jurorId);
    map[candidateId] = true;
    localStorage.setItem(CONFIG.storageRatedPrefix + jurorId, JSON.stringify(map));
  }

  function isRated(jurorId, candidateId) {
    const map = readRatedMap(jurorId);
    return !!map[candidateId];
  }

  // ---------------------------
  // Helpers: Drive URL normalize
  // ---------------------------
  function extractDriveId(anyUrlOrText) {
    const text = String(anyUrlOrText || "").trim();
    if (!text) return "";

    // direct id?
    if (/^[a-zA-Z0-9_-]{20,}$/.test(text)) return text;

    // common patterns
    const patterns = [
      /[?&]id=([a-zA-Z0-9_-]{10,})/i,
      /\/file\/d\/([a-zA-Z0-9_-]{10,})/i,
      /thumbnail\?id=([a-zA-Z0-9_-]{10,})/i,
      /uc\?[^#]*id=([a-zA-Z0-9_-]{10,})/i
    ];

    for (const re of patterns) {
      const m = text.match(re);
      if (m && m[1]) return m[1];
    }
    return "";
  }

  function normalizePhotoUrl(raw) {
    const s = String(raw || "").trim();
    if (!s) return "";

    // if already thumbnail/uc, keep
    if (s.includes("googleusercontent.com") || s.includes("drive.google.com/thumbnail")) {
      return s;
    }

    const id = extractDriveId(s);
    if (!id) return s;

    // thumbnail works great for <img> (fast + cache)
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w240`;
  }

  function normalizeAudioPreviewUrl(raw) {
    const s = String(raw || "").trim();
    if (!s) return "";

    const id = extractDriveId(s);
    if (!id) return "";

    // preview is more reliable than <audio> for Drive (evita 0:00)
    return `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`;
  }

  function normalizeAudioDownloadUrl(raw) {
    const s = String(raw || "").trim();
    if (!s) return "";

    const id = extractDriveId(s);
    if (!id) return s;

    return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
  }

  // ---------------------------
  // API calls
  // ---------------------------
  async function apiGet(action, params = {}) {
    if (!APPS) throw new Error("APPS_SCRIPT_URL não configurado no vma-config.js");
    const url = new URL(APPS);
    url.searchParams.set("action", action);
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }

    const res = await fetch(url.toString(), { method: "GET" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }

  // ---------------------------
  // Render
  // ---------------------------
  function buildCandidateCard(candidate, jurorId) {
    const candidateId = String(candidate.candidateId || "").trim();
    const name = candidate.artisticName || candidate.name || "Candidato";
    const city = candidate.city || "";
    const genre = candidate.genre || "";

    const photoUrl = normalizePhotoUrl(candidate.photoUrl || candidate.photoPublicUrl || "");
    const audioPreview = normalizeAudioPreviewUrl(candidate.audioUrl || candidate.audioPublicUrl || "");
    const audioDownload = normalizeAudioDownloadUrl(candidate.audioUrl || candidate.audioPublicUrl || "");

    const already = isRated(jurorId, candidateId);

    const criteriaHtml = CRITERIA.map((c, idx) => {
      const key = c.key;
      const label = c.label || key;
      const hint = c.hint || "";
      return `
        <div class="crit">
          <div class="critRow">
            <div class="critMeta">
              <div class="critLabel">${escapeHtml(label)}</div>
              <div class="critHint">${escapeHtml(hint)}</div>
            </div>
            <div class="critValue" id="v_${candidateId}_${key}">0</div>
          </div>
          <input
            class="critRange"
            type="range"
            min="0"
            max="10"
            step="1"
            value="0"
            data-candidate="${escapeHtml(candidateId)}"
            data-key="${escapeHtml(key)}"
            ${already ? "disabled" : ""}
          />
        </div>
      `;
    }).join("");

    const disabledAttr = already ? "disabled" : "";

    return `
      <article class="candCard" data-candidate="${escapeHtml(candidateId)}">
        <div class="candTop">
          <div class="candPhotoWrap">
            <img
              class="candPhoto"
              src="${escapeHtml(photoUrl)}"
              alt="Foto de ${escapeHtml(name)}"
              loading="lazy"
              referrerpolicy="no-referrer"
              crossorigin="anonymous"
              onerror="this.style.display='none'; this.parentElement.classList.add('noPhoto');"
            />
            <div class="candPhotoFallback">Foto</div>
          </div>

          <div class="candInfo">
            <div class="candName">${escapeHtml(name)}</div>
            <div class="candBadges">
              <span class="badge">ID: ${escapeHtml(candidateId)}</span>
              ${genre ? `<span class="badge">${escapeHtml(genre)}</span>` : ""}
              ${city ? `<span class="badge">${escapeHtml(city)}</span>` : ""}
            </div>
          </div>

          <div class="candScoreBox">
            <div class="candScoreLabel">TOTAL</div>
            <div class="candScore" id="total_${escapeHtml(candidateId)}">0</div>
            <div class="candScoreMax">/ 100</div>
          </div>
        </div>

        <div class="candMedia">
          ${
            audioPreview
              ? `
                <div class="audioFrameWrap">
                  <iframe
                    class="audioFrame"
                    src="${escapeHtml(audioPreview)}"
                    allow="autoplay"
                    referrerpolicy="no-referrer"
                    loading="lazy"
                  ></iframe>
                </div>
                <a class="audioOpen" href="${escapeHtml(audioDownload)}" target="_blank" rel="noopener noreferrer">
                  Abrir áudio
                </a>
              `
              : `<div class="mediaMissing">Áudio não disponível</div>`
          }
        </div>

        <div class="candBody">
          <div class="sectionTitle">Avaliação Técnica</div>
          <div class="sectionSub">
            A nota final (0–100) é calculada automaticamente pela soma dos critérios.
          </div>

          <div class="criteriaGrid">
            ${criteriaHtml}
          </div>

          <button class="finalBtn" data-finalize="${escapeHtml(candidateId)}" ${disabledAttr}>
            ${already ? "Avaliação já enviada" : "Finalizar avaliação"}
          </button>
          <div class="finalHint">Uma vez enviado, fica <b>travado</b> para este jurado.</div>
        </div>
      </article>
    `;
  }

  function wireRanges() {
    document.querySelectorAll(".critRange").forEach((range) => {
      range.addEventListener("input", () => {
        const candidateId = range.dataset.candidate;
        const key = range.dataset.key;
        const val = toNumberSafe(range.value, 0);

        const vEl = document.getElementById(`v_${candidateId}_${key}`);
        if (vEl) vEl.textContent = String(val);

        updateTotal(candidateId);
      });
    });
  }

  function updateTotal(candidateId) {
    let sum = 0;
    for (const c of CRITERIA) {
      const key = c.key;
      const vEl = document.getElementById(`v_${candidateId}_${key}`);
      const v = vEl ? toNumberSafe(vEl.textContent, 0) : 0;
      sum += v;
    }
    const totalEl = document.getElementById(`total_${candidateId}`);
    if (totalEl) totalEl.textContent = String(sum);
  }

  function readScores(candidateId) {
    const scores = [];
    for (const c of CRITERIA) {
      const key = c.key;
      const el = document.querySelector(`.critRange[data-candidate="${candidateId}"][data-key="${key}"]`);
      scores.push(el ? toNumberSafe(el.value, 0) : 0);
    }
    return scores;
  }

  function disableCard(candidateId) {
    const card = document.querySelector(`.candCard[data-candidate="${candidateId}"]`);
    if (!card) return;
    card.querySelectorAll("input, button").forEach((el) => {
      el.disabled = true;
    });
  }

  async function finalizeCandidate(candidateId) {
    const jurorId = ensureJurorOrAlert();
    if (!jurorId) return;

    if (!SECRET) {
      alert("Config SECRET não encontrado no vma-config.js");
      return;
    }

    if (isRated(jurorId, candidateId)) {
      alert("Você já avaliou este candidato.");
      return;
    }

    const scores = readScores(candidateId);
    const sum = scores.reduce((a, b) => a + b, 0);

    // trava: exige pelo menos 1 ponto (evita envio 0)
    if (sum <= 0) {
      const ok = confirm("Sua nota total está 0. Deseja enviar mesmo assim?");
      if (!ok) return;
    }

    setStatus("info", `Enviando avaliação de ${candidateId}...`);

    try {
      const resp = await apiGet("rate", {
        secret: SECRET,
        jurorId,
        candidateId,
        scores: scores.join(",")
      });

      if (!resp || resp.ok !== true) {
        const err = resp && resp.error ? resp.error : "Erro desconhecido";
        alert(`Falha ao enviar: ${err}`);
        setStatus("error", `❌ Falha ao enviar (${candidateId}): ${err}`);
        return;
      }

      markRated(jurorId, candidateId);
      disableCard(candidateId);
      setStatus("ok", `✅ Avaliação enviada: ${candidateId} (Total ${resp.total100}/100)`);

    } catch (e) {
      alert("Erro ao enviar avaliação. Verifique internet e tente novamente.");
      setStatus("error", `❌ Erro ao enviar: ${e.message || e}`);
    }
  }

  function wireFinalizeButtons() {
    document.querySelectorAll("[data-finalize]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const candidateId = btn.getAttribute("data-finalize");
        if (!candidateId) return;
        await finalizeCandidate(candidateId);
      });
    });
  }

  // ---------------------------
  // Load candidates
  // ---------------------------
  async function loadCandidates() {
    const jurorId = ensureJurorOrAlert(); // melhora UX: já força salvar cedo
    if (!jurorId) return;

    setStatus("info", "Carregando candidatos...");
    const grid = $(CONFIG.gridId);
    if (grid) grid.innerHTML = "";

    try {
      const data = await apiGet("candidates");
      const list = Array.isArray(data?.candidates) ? data.candidates : [];

      if (!list.length) {
        setStatus("info", "Nenhum candidato encontrado ainda.");
        return;
      }

      // render
      if (grid) {
        grid.innerHTML = list.map((c) => buildCandidateCard(c, jurorId)).join("");
      }

      wireRanges();
      wireFinalizeButtons();

      // inicializa totais
      for (const c of list) {
        const id = String(c.candidateId || "").trim();
        if (id) updateTotal(id);
      }

      setStatus("ok", `✅ ${list.length} candidato(s) carregado(s).`);

    } catch (e) {
      setStatus("error", `❌ Erro ao carregar candidatos: ${e.message || e}`);
    }
  }

  // ---------------------------
  // Boot
  // ---------------------------
  function boot() {
    // preenche input com salvo
    const saved = String(localStorage.getItem(CONFIG.storageJurorKey) || "").trim();
    const inp = $(CONFIG.jurorInputId);
    if (inp && saved) inp.value = saved;

    const saveBtn = $(CONFIG.saveJurorBtnId);
    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        const v = saveJurorIdFromInput();
        if (v) loadCandidates();
      });
    }

    const refBtn = $(CONFIG.refreshBtnId);
    if (refBtn) {
      refBtn.addEventListener("click", () => loadCandidates());
    }

    setStatus("info", "Pronto para carregar candidatos...");
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
