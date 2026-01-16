// assets/js/jurados.js
// Vale Music Awards - Jurados (UI + consumo Apps Script + envio de notas)
// Requisitos:
// - window.VMA_CONFIG deve existir (assets/js/vma-config.js carregado no HTML)
// - Endpoint Apps Script:
//    ?action=candidates
//    ?action=rate&secret=...&jurorId=J1&candidateId=VMA-0001&scores=10,10,...(10 itens)

(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const state = {
    jurorId: "",
    candidates: [],
    loading: false,
    lastFetchAt: 0
  };

  function safeConfig() {
    const cfg = window.VMA_CONFIG || null;
    if (!cfg || !cfg.APPS_SCRIPT_URL) return null;
    return cfg;
  }

  function nowIso() {
    try {
      return new Date().toISOString();
    } catch {
      return String(Date.now());
    }
  }

  function setStatus(msg, type = "info") {
    const el = $("#statusBox");
    if (!el) return;
    el.className = `status ${type}`;
    el.textContent = msg;
  }

  function toast(message, type = "info") {
    try {
      const holder = $("#toastHolder");
      if (!holder) {
        alert(message);
        return;
      }

      const t = document.createElement("div");
      t.className = `toast ${type}`;
      t.setAttribute("role", "status");
      t.innerHTML = `
        <div class="toastDot"></div>
        <div class="toastMsg">${escapeHtml(message)}</div>
      `;
      holder.appendChild(t);

      requestAnimationFrame(() => t.classList.add("show"));
      setTimeout(() => {
        t.classList.remove("show");
        setTimeout(() => t.remove(), 300);
      }, 3200);
    } catch (e) {
      // fallback definitivo
      alert(message);
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function loadJurorId() {
    const saved = localStorage.getItem("VMA_JUROR_ID") || "";
    const input = $("#jurorIdInput");
    if (input) input.value = saved;
    state.jurorId = saved.trim();
  }

  function saveJurorId() {
    const input = $("#jurorIdInput");
    const v = (input ? input.value : "").trim().toUpperCase();
    if (!v) {
      toast("Informe seu ID de jurado (ex.: J1).", "warn");
      return;
    }
    if (!/^J\d{1,3}$/i.test(v)) {
      toast("Formato inválido. Use J1, J2, J3...", "warn");
      return;
    }
    localStorage.setItem("VMA_JUROR_ID", v);
    state.jurorId = v;
    toast(`Jurado definido: ${v}`, "ok");
  }

  function buildUrl(base, params) {
    const u = new URL(base);
    Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, String(v)));
    return u.toString();
  }

  async function fetchJson(url, timeoutMs = 20000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "GET",
        cache: "no-store",
        mode: "cors",
        signal: ctrl.signal
      });
      const text = await res.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        // Às vezes volta HTML de erro
        throw new Error(`Resposta não-JSON. HTTP ${res.status}.`);
      }
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      return data;
    } finally {
      clearTimeout(t);
    }
  }

  async function loadCandidates() {
    const cfg = safeConfig();
    if (!cfg) {
      setStatus("Config não carregou (vma-config.js).", "bad");
      toast("Config não carregou: verifique assets/js/vma-config.js no HTML.", "bad");
      return;
    }

    state.loading = true;
    setStatus("Carregando candidatos...", "info");

    try {
      const url = buildUrl(cfg.APPS_SCRIPT_URL, { action: "candidates", t: Date.now() });
      const data = await fetchJson(url);

      const list = Array.isArray(data.candidates) ? data.candidates : [];
      state.candidates = list;
      state.lastFetchAt = Date.now();

      renderCandidates();
      if (list.length) {
        setStatus(`✅ ${list.length} candidato(s) carregado(s).`, "ok");
      } else {
        setStatus("Nenhum candidato encontrado ainda.", "warn");
      }
    } catch (e) {
      console.error("loadCandidates error:", e);
      setStatus("Falha ao carregar candidatos.", "bad");
      toast(`Falha ao carregar candidatos: ${e.message || e}`, "bad");
      renderEmpty();
    } finally {
      state.loading = false;
    }
  }

  function renderEmpty() {
    const list = $("#candidatesList");
    if (!list) return;
    list.innerHTML = `
      <div class="emptyState">
        <div class="emptyTitle">Nenhum candidato</div>
        <div class="emptyText">Quando houver inscrições aprovadas no Forms/Planilha, elas aparecerão aqui automaticamente.</div>
      </div>
    `;
  }

  function normalizePhotoUrl(url) {
    const u = String(url || "").trim();
    if (!u) return "";
    // Se vier "uc?export=view&id=" (alguns casos), mantém.
    // Se vier "open?id=" ou "/file/d/", transforma em uc?export=view&id=
    if (u.includes("drive.google.com/uc?")) return u;
    const m1 = u.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
    const m2 = u.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
    const id = (m1 && m1[1]) || (m2 && m2[1]) || "";
    if (id) return `https://drive.google.com/uc?export=view&id=${id}`;
    return u;
  }

  function normalizeAudioUrl(url) {
    const u = String(url || "").trim();
    if (!u) return "";
    // Para <audio>, "uc?export=download" normalmente funciona bem
    if (u.includes("drive.google.com/uc?")) return u;
    const m1 = u.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
    const m2 = u.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
    const id = (m1 && m1[1]) || (m2 && m2[1]) || "";
    if (id) return `https://drive.google.com/uc?export=download&id=${id}`;
    return u;
  }

  function renderCandidates() {
    const cfg = safeConfig();
    const list = $("#candidatesList");
    if (!list) return;

    if (!state.candidates.length) {
      renderEmpty();
      return;
    }

    const criteria = (cfg && cfg.CRITERIA) ? cfg.CRITERIA : [];
    list.innerHTML = state.candidates.map((c) => {
      const cid = escapeHtml(c.candidateId || "");
      const name = escapeHtml(c.artisticName || c.name || "Candidato");
      const genre = escapeHtml(c.genre || "");
      const city = escapeHtml(c.city || "");
      const photoUrl = normalizePhotoUrl(c.photoUrl);
      const audioUrl = normalizeAudioUrl(c.audioUrl);

      const photoHtml = photoUrl
        ? `<img class="candPhoto" src="${photoUrl}" alt="Foto de ${name}" loading="lazy" />`
        : `<div class="candPhotoPlaceholder">Foto</div>`;

      const audioHtml = audioUrl
        ? `
          <audio class="candAudio" controls preload="metadata" playsinline>
            <source src="${audioUrl}" type="audio/mpeg" />
            Seu navegador não suporta áudio.
          </audio>
          <a class="openAudio" href="${audioUrl}" target="_blank" rel="noopener">Abrir áudio</a>
        `
        : `<div class="audioMissing">Áudio indisponível</div>`;

      const criteriaHtml = criteria.map((cr, idx) => {
        const key = escapeHtml(cr.key || `c${idx}`);
        const label = escapeHtml(cr.label || `Critério ${idx + 1}`);
        const hint = escapeHtml(cr.hint || "");
        return `
          <div class="critRow">
            <div class="critLeft">
              <div class="critLabel">${label}</div>
              <div class="critHint">${hint}</div>
            </div>
            <div class="critRight">
              <input class="critRange" type="range" min="0" max="10" step="1" value="0"
                     data-ckey="${key}" aria-label="${label}">
              <div class="critValue" data-cval="${key}">0</div>
            </div>
          </div>
        `;
      }).join("");

      return `
        <article class="candCard" data-candidate-id="${cid}">
          <div class="candHeader">
            <div class="candPhotoWrap">${photoHtml}</div>

            <div class="candInfo">
              <div class="candName">${name}</div>
              <div class="candBadges">
                <span class="badge">ID: ${cid}</span>
                ${genre ? `<span class="badge">${genre}</span>` : ""}
                ${city ? `<span class="badge">${city}</span>` : ""}
              </div>
              <div class="candAudioWrap">${audioHtml}</div>
            </div>

            <div class="candScore">
              <div class="scoreTitle">TOTAL</div>
              <div class="scoreValue" data-total="${cid}">0</div>
              <div class="scoreSub">/ 100</div>
            </div>
          </div>

          <div class="candBody">
            <div class="sectionTitle">Avaliação Técnica</div>
            <div class="sectionText">A nota final (0–100) é calculada automaticamente pela soma dos critérios.</div>

            <div class="criteriaList">${criteriaHtml}</div>

            <div class="actions">
              <button class="btnPrimary btnFinalize" type="button" data-action="finalize" data-candidate="${cid}">
                Finalizar avaliação
              </button>
              <div class="smallNote">
                Uma vez enviado, fica <b>travado</b> para este jurado.
              </div>
            </div>
          </div>

          <div class="lockedOverlay" data-locked="${cid}">
            <div class="lockedBox">
              <div class="lockedTitle">Avaliação travada</div>
              <div class="lockedMsg">
                Você já avaliou este candidato com este ID de jurado.
                <br>Se precisar corrigir, fale com a organização.
              </div>
            </div>
          </div>
        </article>
      `;
    }).join("");

    // bind sliders (atualiza valores e total)
    $$(".candCard", list).forEach((card) => {
      bindCardRanges(card);
    });
  }

  function bindCardRanges(card) {
    const cid = card.getAttribute("data-candidate-id") || "";
    const ranges = $$(".critRange", card);

    const recalc = () => {
      let total = 0;
      for (const r of ranges) {
        const v = clampInt(r.value, 0, 10);
        total += v;
        const key = r.getAttribute("data-ckey") || "";
        const valBox = card.querySelector(`[data-cval="${CSS.escape(key)}"]`);
        if (valBox) valBox.textContent = String(v);
      }
      const totalEl = card.querySelector(`[data-total="${CSS.escape(cid)}"]`);
      if (totalEl) totalEl.textContent = String(total);
    };

    ranges.forEach((r) => {
      r.addEventListener("input", recalc, { passive: true });
      r.addEventListener("change", recalc, { passive: true });
    });

    recalc();
  }

  function clampInt(v, a, b) {
    const n = Number(v);
    if (!Number.isFinite(n)) return a;
    return Math.max(a, Math.min(b, Math.round(n)));
  }

  function getScoresFromCard(card) {
    const cfg = safeConfig();
    const criteria = (cfg && cfg.CRITERIA) ? cfg.CRITERIA : [];
    const scores = criteria.map((cr, idx) => {
      const key = cr.key || `c${idx}`;
      const input = card.querySelector(`.critRange[data-ckey="${CSS.escape(key)}"]`);
      return clampInt(input ? input.value : 0, 0, 10);
    });
    return scores;
  }

  function lockCard(card) {
    const cid = card.getAttribute("data-candidate-id") || "";
    const overlay = card.querySelector(`[data-locked="${CSS.escape(cid)}"]`);
    if (overlay) overlay.style.display = "flex";
    // desabilita ranges e botão
    $$(".critRange", card).forEach((r) => (r.disabled = true));
    const btn = $(".btnFinalize", card);
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Avaliação travada";
    }
  }

  async function finalizeCandidate(card, candidateId) {
    const cfg = safeConfig();
    if (!cfg) {
      toast("Config não carregou (vma-config.js).", "bad");
      return;
    }

    const jurorId = (state.jurorId || "").trim().toUpperCase();
    if (!jurorId) {
      toast("Defina seu ID de jurado e clique em Salvar.", "warn");
      return;
    }

    const btn = $(".btnFinalize", card);
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Enviando...";
    }

    try {
      const scores = getScoresFromCard(card);
      if (scores.length !== 10) {
        throw new Error("Config de critérios inválida (precisa de 10).");
      }

      // Confirmação final (reduz erro humano)
      const total = scores.reduce((a, b) => a + b, 0);
      const ok = confirm(
        `Confirmar envio?\n\nJurado: ${jurorId}\nCandidato: ${candidateId}\nTotal: ${total}/100\n\nApós enviar, fica travado.`
      );
      if (!ok) {
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Finalizar avaliação";
        }
        return;
      }

      const url = buildUrl(cfg.APPS_SCRIPT_URL, {
        action: "rate",
        secret: cfg.SECRET,
        jurorId,
        candidateId,
        scores: scores.join(","),
        t: Date.now()
      });

      const data = await fetchJson(url, 25000);

      if (!data || data.ok !== true) {
        throw new Error(data?.error || "Falha desconhecida ao salvar.");
      }

      toast("✅ Nota enviada com sucesso! Ranking será atualizado.", "ok");
      lockCard(card);

      // Atualiza candidatos após salvar (pega avgScore100 e count)
      setTimeout(() => loadCandidates(), 900);
    } catch (e) {
      console.error("finalizeCandidate error:", e);

      const msg = String(e?.message || e || "Erro ao salvar.");
      if (msg.includes("ALREADY_RATED") || msg.includes("ALREADY")) {
        toast("Você já avaliou este candidato. Avaliação travada.", "warn");
        lockCard(card);
        return;
      }

      toast(`Falha ao salvar: ${msg}`, "bad");
      // fallback extra (garante que o usuário veja)
      try { alert(`Falha ao salvar:\n${msg}`); } catch {}

      if (btn) {
        btn.disabled = false;
        btn.textContent = "Finalizar avaliação";
      }
    }
  }

  function bindGlobalEvents() {
    const btnSave = $("#btnSaveJuror");
    const btnReload = $("#btnReload");
    const list = $("#candidatesList");

    if (btnSave) btnSave.addEventListener("click", saveJurorId);
    if (btnReload) btnReload.addEventListener("click", () => loadCandidates());

    // Captura forte para mobile (alguns navegadores “perdem” click)
    const handler = async (ev) => {
      const target = ev.target;
      if (!(target instanceof Element)) return;

      const btn = target.closest(".btnFinalize");
      if (!btn) return;

      ev.preventDefault();
      ev.stopPropagation();

      const candidateId = btn.getAttribute("data-candidate") || "";
      if (!candidateId) {
        toast("CandidateId inválido.", "bad");
        return;
      }

      const card = btn.closest(".candCard");
      if (!card) {
        toast("Card do candidato não encontrado.", "bad");
        return;
      }

      await finalizeCandidate(card, candidateId);
    };

    if (list) {
      // pointerdown ajuda a garantir que o evento dispare em mobile
      list.addEventListener("pointerdown", (ev) => {
        const target = ev.target;
        if (!(target instanceof Element)) return;
        if (target.closest(".btnFinalize")) {
          ev.preventDefault();
        }
      }, { passive: false });

      list.addEventListener("click", handler, false);
    }
  }

  function boot() {
    loadJurorId();
    bindGlobalEvents();
    loadCandidates().catch((e) => console.error(e));
    setStatus("Pronto para carregar candidatos...", "info");
    console.log("[VMA Jurados] boot", nowIso());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
