// assets/js/jurados.js
// Vale Music Awards — Área do Jurado (consome Apps Script: candidates + rate)
// Requisitos:
// - vma-config.js carregado antes
// - jurados.html deve ter contêiner #candidatesList, #statusBar, #jurorIdInput, #saveJurorIdBtn

(function () {
  "use strict";

  const cfg = window.VMA_CONFIG;
  if (!cfg || !cfg.APPS_SCRIPT_URL) {
    alert("Config não carregou: verifique assets/js/vma-config.js no HTML.");
    return;
  }

  const el = {
    statusBar: document.getElementById("statusBar"),
    candidatesList: document.getElementById("candidatesList"),
    jurorIdInput: document.getElementById("jurorIdInput"),
    saveJurorIdBtn: document.getElementById("saveJurorIdBtn"),
    refreshBtn: document.getElementById("refreshBtn"),
  };

  function setStatus(text, kind = "info") {
    if (!el.statusBar) return;
    el.statusBar.dataset.kind = kind;
    el.statusBar.textContent = text;
  }

  function esc(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getJurorId() {
    const saved = localStorage.getItem("vma_juror_id");
    if (saved) return saved;
    return "";
  }

  function saveJurorId(id) {
    const v = String(id || "").trim();
    if (!v) return false;
    localStorage.setItem("vma_juror_id", v);
    return true;
  }

  function keyRated(jurorId, candidateId) {
    return `vma_rated_${jurorId}__${candidateId}`;
  }

  function isRatedLocal(jurorId, candidateId) {
    return localStorage.getItem(keyRated(jurorId, candidateId)) === "1";
  }

  function markRatedLocal(jurorId, candidateId) {
    localStorage.setItem(keyRated(jurorId, candidateId), "1");
  }

  async function fetchJson(url) {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${res.statusText} ${txt}`.trim());
    }
    return await res.json();
  }

  function buildCandidatesUrl() {
    const u = new URL(cfg.APPS_SCRIPT_URL);
    u.searchParams.set("action", "candidates");
    // cache bust
    u.searchParams.set("_ts", String(Date.now()));
    return u.toString();
  }

  function buildRateUrl({ jurorId, candidateId, scores }) {
    const u = new URL(cfg.APPS_SCRIPT_URL);
    u.searchParams.set("action", "rate");
    u.searchParams.set("secret", cfg.SECRET);
    u.searchParams.set("jurorId", jurorId);
    u.searchParams.set("candidateId", candidateId);
    u.searchParams.set("scores", scores.join(","));
    u.searchParams.set("_ts", String(Date.now()));
    return u.toString();
  }

  function sumScores(scores) {
    return scores.reduce((a, b) => a + b, 0);
  }

  function clampScore(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.min(10, Math.max(0, x));
  }

  function createCriterionRow(criterion, idx, defaultValue = 0) {
    const row = document.createElement("div");
    row.className = "critRow";

    const left = document.createElement("div");
    left.className = "critLeft";
    left.innerHTML = `
      <div class="critLabel">${esc(criterion.label)}</div>
      <div class="critHint">${esc(criterion.hint || "")}</div>
    `;

    const right = document.createElement("div");
    right.className = "critRight";
    right.innerHTML = `
      <input class="critRange" type="range" min="0" max="10" step="1" value="${defaultValue}" data-idx="${idx}">
      <div class="critValue" data-idx="${idx}">${defaultValue}</div>
    `;

    row.appendChild(left);
    row.appendChild(right);
    return row;
  }

  function disableCard(card, message) {
    card.classList.add("locked");
    const overlay = card.querySelector(".lockedOverlay");
    if (overlay) {
      overlay.querySelector(".lockedMsg").textContent = message || "Avaliação registrada e travada.";
      overlay.style.display = "flex";
    }
    const inputs = card.querySelectorAll("input, button, select, textarea");
    inputs.forEach((i) => (i.disabled = true));
  }

  function renderCandidateCard(candidate, jurorId) {
    const cId = candidate.candidateId;
    const displayName = candidate.artisticName || candidate.name || cId;

    const card = document.createElement("article");
    card.className = "candCard";
    card.dataset.candidateId = cId;

    const ratedAlready = isRatedLocal(jurorId, cId);

    card.innerHTML = `
      <div class="candTop">
        <div class="candPhoto">
          ${candidate.photoUrl ? `<img src="${esc(candidate.photoUrl)}" alt="Foto de ${esc(displayName)}">` : `<div class="photoPh">Sem foto</div>`}
        </div>
        <div class="candInfo">
          <div class="candName">${esc(displayName)}</div>
          <div class="candMeta">
            <span class="tag">ID: ${esc(cId)}</span>
            ${candidate.genre ? `<span class="tag">${esc(candidate.genre)}</span>` : ""}
            ${candidate.city ? `<span class="tag">${esc(candidate.city)}</span>` : ""}
          </div>

          <div class="audioWrap">
            ${candidate.audioUrl ? `
              <audio controls preload="none" src="${esc(candidate.audioUrl)}"></audio>
            ` : `<div class="muted">Sem áudio disponível</div>`}
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
            <div class="totalValue" id="total_${esc(cId)}">0</div>
            <div class="totalMax">/ 100</div>
          </div>
        </div>

        <div class="criteriaList" id="criteria_${esc(cId)}"></div>

        <div class="actions">
          <button class="btnPrimary" data-action="submit" data-id="${esc(cId)}">Finalizar avaliação (travar)</button>
          <div class="smallNote">Após finalizar, não será possível alterar.</div>
        </div>
      </div>

      <div class="lockedOverlay" style="display:none;">
        <div class="lockedBox">
          <div class="lockedTitle">Avaliação concluída</div>
          <div class="lockedMsg">Avaliação registrada e travada.</div>
        </div>
      </div>
    `;

    // Inject criteria
    const list = card.querySelector(`#criteria_${CSS.escape(cId)}`);
    const totalEl = card.querySelector(`#total_${CSS.escape(cId)}`);
    const ranges = [];

    cfg.CRITERIA.forEach((crit, idx) => {
      const row = createCriterionRow(crit, idx, 0);
      list.appendChild(row);
    });

    // Track range inputs
    const rangeEls = card.querySelectorAll(".critRange");
    rangeEls.forEach((r) => ranges.push(r));

    function updateTotal() {
      const scores = ranges.map((r) => clampScore(r.value));
      const total = sumScores(scores);
      totalEl.textContent = String(total);
      // update values next to sliders
      const valueEls = card.querySelectorAll(".critValue");
      valueEls.forEach((v) => {
        const idx = Number(v.dataset.idx);
        v.textContent = String(scores[idx] ?? 0);
      });
      return scores;
    }

    // Live update
    ranges.forEach((r) => {
      r.addEventListener("input", updateTotal);
      r.addEventListener("change", updateTotal);
    });

    // Submit
    const submitBtn = card.querySelector('button[data-action="submit"]');
    submitBtn.addEventListener("click", async () => {
      try {
        if (!jurorId) {
          alert("Defina seu ID de jurado (ex: J1, J2, J3...) antes de avaliar.");
          return;
        }
        if (ratedAlready || isRatedLocal(jurorId, cId)) {
          disableCard(card, "Você já avaliou este candidato. Avaliação travada.");
          return;
        }

        const scores = updateTotal(); // 10 itens
        const total = sumScores(scores);

        if (scores.length !== cfg.CRITERIA.length) {
          alert("Erro interno: quantidade de critérios inválida.");
          return;
        }

        // confirmação premium
        const ok = confirm(
          `Confirmar envio da avaliação?\n\nCandidato: ${displayName}\nID: ${cId}\nNota final (automática): ${total}/100\n\nApós enviar, não será possível alterar.`
        );
        if (!ok) return;

        submitBtn.disabled = true;
        submitBtn.textContent = "Enviando...";

        const url = buildRateUrl({ jurorId, candidateId: cId, scores });
        const resp = await fetchJson(url);

        if (!resp.ok) {
          const msg = resp.error || "Falha ao registrar avaliação.";
          if (msg === "ALREADY_RATED") {
            markRatedLocal(jurorId, cId);
            disableCard(card, "Você já avaliou este candidato. Avaliação travada.");
            return;
          }
          throw new Error(msg);
        }

        markRatedLocal(jurorId, cId);
        disableCard(card, "Avaliação registrada e travada. Ranking será atualizado automaticamente.");

        setStatus("✅ Avaliação enviada. Ranking atualizado automaticamente.", "ok");
      } catch (err) {
        console.error(err);
        alert("Erro ao enviar avaliação: " + (err?.message || err));
        submitBtn.disabled = false;
        submitBtn.textContent = "Finalizar avaliação (travar)";
        setStatus("⚠️ Falha ao enviar avaliação. Verifique conexão/permissões do Web App.", "warn");
      }
    });

    // init total
    updateTotal();

    // if already rated locally, lock it
    if (ratedAlready) {
      disableCard(card, "Você já avaliou este candidato. Avaliação travada.");
    }

    return card;
  }

  async function loadCandidates() {
    const jurorId = getJurorId();
    setStatus("Carregando candidatos...", "info");
    el.candidatesList.innerHTML = "";

    const url = buildCandidatesUrl();
    const data = await fetchJson(url);

    if (!data.ok) throw new Error(data.error || "Erro ao carregar candidatos.");

    const candidates = Array.isArray(data.candidates) ? data.candidates : [];
    if (!candidates.length) {
      el.candidatesList.innerHTML = `<div class="emptyState">Nenhum candidato encontrado ainda. Assim que o Forms receber respostas, eles aparecerão aqui.</div>`;
      setStatus("Nenhum candidato no momento.", "info");
      return;
    }

    // ordena por status e depois por avg
    candidates.sort((a, b) => {
      const sa = String(a.status || "");
      const sb = String(b.status || "");
      if (sa !== sb) return sa.localeCompare(sb);
      return (Number(b.avgScore100 || 0) - Number(a.avgScore100 || 0));
    });

    const frag = document.createDocumentFragment();
    candidates.forEach((c) => frag.appendChild(renderCandidateCard(c, jurorId)));

    el.candidatesList.appendChild(frag);
    setStatus(`✅ ${candidates.length} candidato(s) carregado(s).`, "ok");
  }

  function wireUi() {
    // juror id
    const initial = getJurorId();
    if (el.jurorIdInput) el.jurorIdInput.value = initial;

    if (el.saveJurorIdBtn) {
      el.saveJurorIdBtn.addEventListener("click", () => {
        const v = String(el.jurorIdInput?.value || "").trim();
        if (!v) {
          alert("Digite um ID de jurado (ex: J1, J2, J3, J4, J5).");
          return;
        }
        saveJurorId(v);
        alert("ID do jurado salvo: " + v);
        // recarrega para aplicar travas locais corretamente
        loadCandidates().catch((e) => {
          console.error(e);
          setStatus("⚠️ Erro ao carregar candidatos.", "warn");
        });
      });
    }

    if (el.refreshBtn) {
      el.refreshBtn.addEventListener("click", () => {
        loadCandidates().catch((e) => {
          console.error(e);
          setStatus("⚠️ Erro ao carregar candidatos.", "warn");
        });
      });
    }
  }

  // start
  wireUi();
  loadCandidates().catch((e) => {
    console.error(e);
    setStatus("⚠️ Não foi possível carregar candidatos. Verifique se o Web App está publicado como 'Qualquer pessoa' e se o link está correto.", "warn");
    el.candidatesList.innerHTML = `<div class="emptyState">Falha ao carregar candidatos. Verifique o link do Web App e as permissões.</div>`;
  });
})();
