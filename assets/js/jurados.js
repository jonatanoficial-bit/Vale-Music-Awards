// assets/js/jurados.js
// Vale Music Awards - Área de Jurados
// Login: Firebase Auth (já existente no seu site)
// Dados: Google Forms + Sheets + Apps Script (candidates / rate / ranking)

import { VMA_CONFIG } from "./vma-config.js";

// Tentamos usar Firebase Auth para garantir acesso
// (se o seu firebase.js exporta "auth", funciona automaticamente).
let auth = null;
try {
  // se existir no seu projeto:
  // export const auth = getAuth(app);
  const fb = await import("./firebase.js");
  auth = fb.auth || null;
} catch (e) {
  // Se falhar, ainda podemos rodar, mas sem travar por login.
  // (Você disse que o login já está funcionando; isso aqui é só fallback.)
  console.warn("[VMA] Não consegui importar ./firebase.js. Continuando sem checagem de login.", e);
}

(function initJurados() {
  const root = document.getElementById("juradosRoot") || document.body;
  const listEl = document.getElementById("candidatesList");
  const loadingEl = document.getElementById("loadingJurados");
  const errorEl = document.getElementById("errorJurados");
  const userEl = document.getElementById("juradoUser");
  const refreshBtn = document.getElementById("btnRefreshCandidates");

  const criteria = Array.isArray(VMA_CONFIG?.CRITERIA) && VMA_CONFIG.CRITERIA.length
    ? VMA_CONFIG.CRITERIA
    : [
        { key: "afinacao", label: "Afinação" },
        { key: "ritmo", label: "Ritmo / Tempo" },
        { key: "interpretacao", label: "Interpretação" },
        { key: "dicao", label: "Pronúncia / Dicção" },
        { key: "timbre", label: "Timbre / Qualidade vocal" },
        { key: "controle", label: "Controle vocal / Apoio" },
        { key: "dinamica", label: "Dinâmica" },
        { key: "extensao", label: "Extensão / Alcance" },
        { key: "musicalidade", label: "Musicalidade" },
        { key: "potencial", label: "Potencial artístico" }
      ];

  function setLoading(isLoading) {
    if (loadingEl) loadingEl.style.display = isLoading ? "block" : "none";
  }

  function setError(msg) {
    if (errorEl) {
      errorEl.style.display = msg ? "block" : "none";
      errorEl.textContent = msg || "";
    } else if (msg) {
      alert(msg);
    }
  }

  function ensureList() {
    if (listEl) return listEl;
    const div = document.createElement("div");
    div.id = "candidatesList";
    root.appendChild(div);
    return div;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getJurorId() {
    // Preferimos UID (estável), senão email (padrão), senão "JUROR"
    try {
      const u = auth?.currentUser || null;
      if (u?.uid) return `J-${u.uid}`;
      if (u?.email) return `J-${String(u.email).toLowerCase()}`;
    } catch (_) {}
    return "JUROR";
  }

  function lockKey(candidateId) {
    return `VMA_LOCK_${getJurorId()}_${candidateId}`;
  }

  function isLocked(candidateId) {
    return localStorage.getItem(lockKey(candidateId)) === "1";
  }

  function setLocked(candidateId) {
    localStorage.setItem(lockKey(candidateId), "1");
  }

  function buildCandidatesUrl() {
    return `${VMA_CONFIG.APPS_SCRIPT_URL}?action=candidates`;
  }

  function buildRateUrl({ jurorId, candidateId, scores }) {
    const qs = new URLSearchParams({
      action: "rate",
      secret: VMA_CONFIG.SECRET,
      jurorId,
      candidateId,
      scores: scores.join(",")
    });
    return `${VMA_CONFIG.APPS_SCRIPT_URL}?${qs.toString()}`;
  }

  async function fetchJson(url) {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${res.statusText} ${t}`);
    }
    return await res.json();
  }

  function createCandidateCard(candidate) {
    const {
      candidateId,
      name,
      artisticName,
      city,
      genre,
      whatsapp,
      photoUrl,
      audioUrl,
      avgScore100,
      scoresCount,
      status
    } = candidate;

    const displayName = artisticName || name || candidateId;

    const card = document.createElement("div");
    card.className = "vma-card vma-candidate";
    card.dataset.candidateId = candidateId;

    const locked = isLocked(candidateId);

    card.innerHTML = `
      <div class="vma-cand-header">
        <div class="vma-cand-left">
          <div class="vma-cand-photo">
            ${photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(displayName)}" />` : `<div class="vma-photo-placeholder">Sem foto</div>`}
          </div>
          <div class="vma-cand-meta">
            <div class="vma-cand-title">
              <span class="vma-cand-name">${escapeHtml(displayName)}</span>
              <span class="vma-pill">ID: ${escapeHtml(candidateId)}</span>
              <span class="vma-pill vma-pill-muted">${escapeHtml(status || "PENDING")}</span>
            </div>
            <div class="vma-cand-sub">
              ${city ? `<span>${escapeHtml(city)}</span>` : ""}
              ${genre ? `<span>• ${escapeHtml(genre)}</span>` : ""}
              ${whatsapp ? `<span>• WhatsApp: ${escapeHtml(whatsapp)}</span>` : ""}
            </div>
            <div class="vma-cand-scoreinfo">
              <span class="vma-pill vma-pill-gold">Média: ${Number(avgScore100 || 0).toFixed(2)} / 100</span>
              <span class="vma-pill">Avaliações: ${Number(scoresCount || 0)}</span>
            </div>
          </div>
        </div>

        <div class="vma-cand-right">
          <div class="vma-audio-box">
            ${
              audioUrl
                ? `<audio controls preload="none" src="${escapeHtml(audioUrl)}"></audio>`
                : `<div class="vma-audio-missing">Sem áudio</div>`
            }
          </div>
        </div>
      </div>

      <div class="vma-divider"></div>

      <div class="vma-eval">
        <div class="vma-eval-top">
          <div class="vma-eval-title">Avaliação técnica (0–10) • Soma automática (0–100)</div>
          <div class="vma-eval-total">
            Total: <span class="vma-total-number">0</span>/100
          </div>
        </div>

        <div class="vma-eval-grid"></div>

        <div class="vma-eval-actions">
          <button class="vma-btn vma-btn-primary btnEnviarNota" ${locked ? "disabled" : ""}>
            ${locked ? "Enviado (travado)" : "Enviar nota (travamento definitivo)"}
          </button>
          <span class="vma-eval-msg"></span>
        </div>

        <div class="vma-eval-warning">
          Ao enviar, esta avaliação ficará <strong>travada</strong> e não poderá ser alterada.
        </div>
      </div>
    `;

    // Build sliders/inputs
    const grid = card.querySelector(".vma-eval-grid");
    const totalEl = card.querySelector(".vma-total-number");
    const msgEl = card.querySelector(".vma-eval-msg");
    const btn = card.querySelector(".btnEnviarNota");

    const inputs = [];

    criteria.forEach((c) => {
      const row = document.createElement("div");
      row.className = "vma-crit-row";
      row.innerHTML = `
        <div class="vma-crit-label">${escapeHtml(c.label)}</div>
        <div class="vma-crit-input">
          <input type="number" min="0" max="10" step="1" value="0" class="vma-score-input" ${locked ? "disabled" : ""} />
        </div>
      `;
      const inp = row.querySelector("input");
      inputs.push(inp);

      inp.addEventListener("input", () => {
        const n = clampScore(Number(inp.value));
        inp.value = String(n);
        updateTotal();
      });

      grid.appendChild(row);
    });

    function clampScore(n) {
      if (!Number.isFinite(n)) return 0;
      if (n < 0) return 0;
      if (n > 10) return 10;
      return Math.round(n);
    }

    function updateTotal() {
      const sum = inputs.reduce((acc, i) => acc + clampScore(Number(i.value)), 0);
      totalEl.textContent = String(sum);
      return sum;
    }

    // initial total
    updateTotal();

    async function sendRating() {
      msgEl.textContent = "";
      setError("");

      if (locked) return;

      // bloqueia se faltar áudio
      if (!audioUrl) {
        msgEl.textContent = "Sem áudio para avaliar.";
        return;
      }

      const jurorId = getJurorId();
      const scores = inputs.map((i) => clampScore(Number(i.value)));

      // valida length
      if (scores.length !== criteria.length) {
        msgEl.textContent = "Erro interno: critérios incompletos.";
        return;
      }

      // Confirm suave (sem quebrar UX)
      const ok = confirm(
        `Confirmar envio?\n\nCandidato: ${displayName}\nID: ${candidateId}\nTotal: ${scores.reduce((a,b)=>a+b,0)}/100\n\nApós enviar, NÃO será possível alterar.`
      );
      if (!ok) return;

      // trava UI primeiro para evitar duplo clique
      btn.disabled = true;
      inputs.forEach((i) => (i.disabled = true));
      btn.textContent = "Enviando...";

      try {
        const url = buildRateUrl({ jurorId, candidateId, scores });
        const resp = await fetchJson(url);

        if (!resp.ok) {
          // reabre UI se falhar
          btn.disabled = false;
          inputs.forEach((i) => (i.disabled = false));
          btn.textContent = "Enviar nota (travamento definitivo)";

          if (resp.error === "ALREADY_RATED") {
            // trava definitivo (porque já foi avaliado antes)
            setLocked(candidateId);
            btn.disabled = true;
            inputs.forEach((i) => (i.disabled = true));
            btn.textContent = "Enviado (travado)";
            msgEl.textContent = "Você já avaliou este candidato. (travado)";
            return;
          }

          msgEl.textContent = `Erro ao enviar: ${resp.error || "Falha desconhecida"}`;
          return;
        }

        // sucesso: trava definitivo
        setLocked(candidateId);
        btn.disabled = true;
        inputs.forEach((i) => (i.disabled = true));
        btn.textContent = "Enviado (travado)";
        msgEl.textContent = `Nota enviada com sucesso. Total: ${resp.total100}/100`;

        // Atualiza média exibida (busca ranking/candidates novamente)
        // (não é obrigatório, mas dá sensação “ao vivo”)
        setTimeout(() => {
          loadCandidates(true).catch(() => {});
        }, 1200);
      } catch (err) {
        console.error(err);

        // reabre UI se falhar
        btn.disabled = false;
        inputs.forEach((i) => (i.disabled = false));
        btn.textContent = "Enviar nota (travamento definitivo)";
        msgEl.textContent = `Erro de conexão: ${err.message || err}`;
      }
    }

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      sendRating();
    });

    // Se já estiver travado localmente, mantém travado
    if (locked) {
      msgEl.textContent = "Este candidato já foi avaliado por você e está travado.";
    }

    return card;
  }

  async function loadCandidates(silent = false) {
    setError("");
    if (!silent) setLoading(true);

    const container = ensureList();
    if (!silent) container.innerHTML = "";

    try {
      const url = buildCandidatesUrl();
      const data = await fetchJson(url);

      if (!data?.ok) {
        throw new Error(data?.error || "Resposta inválida do servidor.");
      }

      const candidates = Array.isArray(data.candidates) ? data.candidates : [];

      // Ordena: pendentes primeiro, depois por avg desc
      candidates.sort((a, b) => {
        const as = String(a.status || "").toUpperCase();
        const bs = String(b.status || "").toUpperCase();
        if (as !== bs) {
          if (as === "PENDING") return -1;
          if (bs === "PENDING") return 1;
        }
        return (Number(b.avgScore100 || 0) - Number(a.avgScore100 || 0));
      });

      if (!silent) container.innerHTML = "";

      if (!candidates.length) {
        const empty = document.createElement("div");
        empty.className = "vma-empty";
        empty.textContent = "Nenhum candidato ainda. Aguarde novas inscrições.";
        container.appendChild(empty);
        return;
      }

      for (const c of candidates) {
        const card = createCandidateCard(c);
        container.appendChild(card);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function guardAuthAndLoad() {
    // Se auth existir, exige login
    if (auth && typeof auth.onAuthStateChanged === "function") {
      setLoading(true);
      auth.onAuthStateChanged(async (user) => {
        if (!user) {
          setLoading(false);
          setError("Você precisa estar logado como jurado para acessar esta área.");
          if (listEl) listEl.innerHTML = "";
          if (userEl) userEl.textContent = "";
          return;
        }

        if (userEl) {
          userEl.textContent = user.email ? `Jurado: ${user.email}` : `Jurado: ${user.uid}`;
        }

        try {
          await loadCandidates(false);
        } catch (err) {
          console.error(err);
          setError(`Falha ao carregar candidatos: ${err.message || err}`);
        } finally {
          setLoading(false);
        }
      });
      return;
    }

    // Sem auth: apenas carrega
    if (userEl) userEl.textContent = "Jurado: (modo sem auth)";
    try {
      await loadCandidates(false);
    } catch (err) {
      console.error(err);
      setError(`Falha ao carregar candidatos: ${err.message || err}`);
    }
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", (e) => {
      e.preventDefault();
      loadCandidates(false).catch((err) => setError(err.message || String(err)));
    });
  }

  // Começa
  guardAuthAndLoad();
})();