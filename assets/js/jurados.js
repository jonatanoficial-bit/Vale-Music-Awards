// assets/js/jurados.js
// Vale Music Awards - Jurados (Forms + Apps Script API)
// - Carrega candidatos do Apps Script (?action=candidates)
// - Mostra foto + player de áudio
// - Avaliação 10 critérios (0..10) => soma 0..100 automática
// - Envia nota pro Apps Script (?action=rate) e trava (não deixa editar depois)
// - Atualiza ranking automaticamente após enviar

import { auth } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

/* =========================
   CONFIG (lido de vma-config.js)
========================= */
function getCfg() {
  // vma-config.js deve definir window.VMA_CONFIG
  const cfg = window.VMA_CONFIG || null;
  if (!cfg || !cfg.appsScriptUrl) return null;
  return cfg;
}

/* =========================
   HELPERS
========================= */
function $(sel) {
  return document.querySelector(sel);
}

function el(tag, cls) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  return n;
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, x));
}

/**
 * Extrai ID do Drive de vários formatos:
 * - https://drive.google.com/uc?export=download&id=ID
 * - https://drive.google.com/uc?export=view&id=ID
 * - https://drive.google.com/file/d/ID/view
 * - ...?id=ID
 */
function extractDriveId(url) {
  const u = String(url || "").trim();
  if (!u) return "";
  const m1 = u.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (m1 && m1[1]) return m1[1];
  const m2 = u.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
  if (m2 && m2[1]) return m2[1];
  return "";
}

/**
 * Normaliza URL do Drive para uso em <img> e <audio>
 * - Foto: export=view (mais confiável em <img>)
 * - Áudio: usa uc?id=ID (mais "stream" do que export=download)
 */
function normalizeMediaUrl(originalUrl, kind) {
  const id = extractDriveId(originalUrl);
  if (!id) return String(originalUrl || "").trim();

  if (kind === "photo") {
    return `https://drive.google.com/uc?export=view&id=${id}`;
  }

  // kind === "audio"
  // Esse formato costuma funcionar melhor no <audio> que export=download
  return `https://drive.google.com/uc?id=${id}`;
}

/* =========================
   CRITÉRIOS (0..10) => total 0..100
========================= */
const CRITERIA = [
  { key: "afinacao", label: "Afinação", desc: "Precisão das notas, estabilidade e controle." },
  { key: "ritmo", label: "Ritmo & Tempo", desc: "Pulsação, entradas/saídas e regularidade." },
  { key: "interpretacao", label: "Interpretação", desc: "Expressão, intenção e emoção musical." },
  { key: "dicao", label: "Pronúncia & Dicção", desc: "Clareza das palavras e articulação." },
  { key: "timbre", label: "Timbre", desc: "Qualidade sonora, identidade e consistência." },
  { key: "controle", label: "Controle Vocal", desc: "Apoio, respiração e sustentação." },
  { key: "dinamica", label: "Dinâmica", desc: "Variação de intensidade e nuance musical." },
  { key: "extensao", label: "Extensão & Alcance", desc: "Conforto nas regiões graves/agudas." },
  { key: "musicalidade", label: "Musicalidade", desc: "Fraseado, harmonia e bom gosto." },
  { key: "potencial", label: "Potencial Artístico", desc: "Presença, identidade e mercado." }
];

/* =========================
   STATE
========================= */
let CFG = null;
let candidates = [];
let jurorId = "";
let lockMap = {}; // candidateId => true se já enviado (travado)

/* =========================
   UI HOOKS
========================= */
function bindTopBar() {
  const jurorInput = $("#jurorId");
  const btnSave = $("#btnSaveJuror");
  const btnRefresh = $("#btnRefresh");
  const btnLogout = $("#btnLogout");

  // carrega jurorId salvo
  const saved = localStorage.getItem("vma_jurorId") || "";
  if (jurorInput) jurorInput.value = saved;
  jurorId = saved.trim();

  if (btnSave) {
    btnSave.addEventListener("click", () => {
      const v = (jurorInput?.value || "").trim().toUpperCase();
      if (!v) {
        alert("Informe seu ID de jurado (ex.: J1).");
        return;
      }
      jurorId = v;
      localStorage.setItem("vma_jurorId", v);
      alert("ID do jurado salvo.");
    });
  }

  if (btnRefresh) {
    btnRefresh.addEventListener("click", async () => {
      await loadCandidates();
      renderCandidates();
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      try {
        await signOut(auth);
      } catch (e) {}
      window.location.href = "../pages/jurados.html";
    });
  }
}

/* =========================
   AUTH GATE
========================= */
function initAuthGuard() {
  const authBox = $("#authStatus");
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      if (authBox) authBox.textContent = "Acesso negado. Faça login para continuar.";
      // mantém a página, mas sem dados
      $("#candidatesList")?.classList.add("hidden");
      return;
    }
    if (authBox) authBox.textContent = `Logado: ${user.email || "Jurado"}`;
    $("#candidatesList")?.classList.remove("hidden");
  });
}

/* =========================
   API
========================= */
async function apiGet(action, params = {}) {
  const url = new URL(CFG.appsScriptUrl);
  url.searchParams.set("action", action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) throw new Error(`Falha no endpoint (${res.status}).`);
  return await res.json();
}

async function loadCandidates() {
  const status = $("#loadStatus");
  if (status) status.textContent = "Carregando candidatos...";

  const data = await apiGet("candidates");
  if (!data || !data.ok) throw new Error(data?.error || "Erro ao carregar candidatos.");

  candidates = Array.isArray(data.candidates) ? data.candidates : [];

  // trava local por jurado + candidato (não permite reenviar depois)
  // Mesmo que a API já bloqueie, isso evita UX confusa
  const jur = (localStorage.getItem("vma_jurorId") || "").trim().toUpperCase();
  if (jur) {
    const key = `vma_lock_${jur}`;
    lockMap = JSON.parse(localStorage.getItem(key) || "{}") || {};
  } else {
    lockMap = {};
  }

  if (status) status.textContent = `✅ ${candidates.length} candidato(s) carregado(s).`;
}

/* =========================
   RENDER
========================= */
function renderCandidates() {
  const wrap = $("#candidatesList");
  if (!wrap) return;

  wrap.innerHTML = "";

  if (!candidates.length) {
    const empty = el("div", "vma-empty");
    empty.textContent = "Nenhum candidato encontrado ainda.";
    wrap.appendChild(empty);
    return;
  }

  for (const c of candidates) {
    wrap.appendChild(renderCandidateCard(c));
  }
}

function renderCandidateCard(c) {
  const card = el("div", "vma-card");

  // header
  const head = el("div", "vma-card-head");

  const photoWrap = el("div", "vma-photo");
  const img = el("img");
  img.alt = `Foto de ${c.artisticName || c.name || "Candidato"}`;
  img.loading = "lazy";
  img.referrerPolicy = "no-referrer"; // ajuda em alguns casos com Drive
  img.src = normalizeMediaUrl(c.photoUrl, "photo");
  img.onerror = () => {
    img.src = "../assets/img/avatar-placeholder.png";
  };
  photoWrap.appendChild(img);

  const info = el("div", "vma-info");
  const title = el("div", "vma-title");
  title.textContent = (c.artisticName || c.name || "Candidato").toLowerCase();
  const meta = el("div", "vma-meta");
  meta.innerHTML = `
    <span class="pill">ID: ${escapeHtml(c.candidateId || "-")}</span>
    <span class="pill">${escapeHtml(c.genre || "-")}</span>
    <span class="pill">${escapeHtml(c.city || "-")}</span>
  `;

  info.appendChild(title);
  info.appendChild(meta);

  head.appendChild(photoWrap);
  head.appendChild(info);

  // audio
  const audioBox = el("div", "vma-audio");
  const audio = el("audio");
  audio.controls = true;
  audio.preload = "metadata"; // tenta ler metadata sem baixar tudo

  // AQUI é a diferença crítica: <source type="audio/mpeg">
  const src = el("source");
  src.src = normalizeMediaUrl(c.audioUrl, "audio");
  src.type = "audio/mpeg";
  audio.appendChild(src);

  // fallback link
  const fallback = el("a", "vma-audio-link");
  fallback.href = c.audioUrl || "#";
  fallback.target = "_blank";
  fallback.rel = "noreferrer";
  fallback.textContent = "Abrir áudio em nova aba";
  fallback.style.display = "none";

  // se der erro no áudio, mostra fallback
  audio.addEventListener("error", () => {
    fallback.style.display = "inline-flex";
  });

  audioBox.appendChild(audio);
  audioBox.appendChild(fallback);

  // avaliação
  const evalBox = el("div", "vma-eval");

  const evalHeader = el("div", "vma-eval-head");
  const evalTitle = el("div", "vma-eval-title");
  evalTitle.innerHTML = `
    <div class="h">Avaliação Técnica</div>
    <div class="p">A nota final (0–100) é calculada automaticamente pela soma dos critérios.</div>
  `;

  const totalBox = el("div", "vma-total");
  totalBox.innerHTML = `<div class="t">TOTAL</div><div class="n">0</div><div class="s">/ 100</div>`;
  const totalNum = totalBox.querySelector(".n");

  evalHeader.appendChild(evalTitle);
  evalHeader.appendChild(totalBox);

  evalBox.appendChild(evalHeader);

  // sliders
  const sliders = [];
  for (const crit of CRITERIA) {
    const row = el("div", "vma-crit");

    const left = el("div", "vma-crit-left");
    left.innerHTML = `<div class="l">${escapeHtml(crit.label)}</div><div class="d">${escapeHtml(crit.desc)}</div>`;

    const right = el("div", "vma-crit-right");

    const input = el("input");
    input.type = "range";
    input.min = "0";
    input.max = "10";
    input.step = "1";
    input.value = "0";

    const value = el("div", "vma-crit-val");
    value.textContent = "0";

    input.addEventListener("input", () => {
      value.textContent = String(input.value);
      updateTotal();
    });

    right.appendChild(input);
    right.appendChild(value);

    row.appendChild(left);
    row.appendChild(right);

    evalBox.appendChild(row);

    sliders.push({ key: crit.key, input });
  }

  // footer actions
  const actions = el("div", "vma-actions");

  const btnSend = el("button", "vma-btn vma-btn-primary");
  btnSend.type = "button";
  btnSend.textContent = "Finalizar avaliação (enviar)";

  const btnLock = el("div", "vma-lock");
  btnLock.textContent = "Após enviar, a avaliação fica travada e não pode ser alterada.";

  actions.appendChild(btnSend);
  actions.appendChild(btnLock);

  evalBox.appendChild(actions);

  function updateTotal() {
    const sum = sliders.reduce((acc, s) => acc + Number(s.input.value || 0), 0);
    if (totalNum) totalNum.textContent = String(sum);
    return sum; // 0..100
  }

  // trava se já enviado
  const alreadyLocked = !!lockMap[c.candidateId];
  if (alreadyLocked) {
    setLockedUI(true);
  }

  function setLockedUI(lock) {
    for (const s of sliders) s.input.disabled = lock;
    btnSend.disabled = lock;
    btnSend.textContent = lock ? "Avaliação enviada (travada)" : "Finalizar avaliação (enviar)";
    card.classList.toggle("is-locked", lock);
  }

  btnSend.addEventListener("click", async () => {
    const jur = (localStorage.getItem("vma_jurorId") || "").trim().toUpperCase();
    if (!jur) {
      alert("Defina seu ID de jurado (ex.: J1) e clique em Salvar.");
      return;
    }

    // soma automática
    const total = updateTotal(); // 0..100
    if (total <= 0) {
      const ok = confirm("Sua nota total está 0. Tem certeza que deseja enviar assim?");
      if (!ok) return;
    }

    // monta scores em ordem (10 itens)
    const scores = sliders.map(s => clamp(s.input.value, 0, 10)).join(",");

    // confirmação final (sem volta)
    const confirmSend = confirm(
      `Confirmar envio?\n\nCandidato: ${c.candidateId}\nJurado: ${jur}\nTotal (automático): ${total}/100\n\nApós enviar, não será possível alterar.`
    );
    if (!confirmSend) return;

    btnSend.disabled = true;
    btnSend.textContent = "Enviando...";

    try {
      const res = await apiGet("rate", {
        secret: CFG.secret,
        jurorId: jur,
        candidateId: c.candidateId,
        scores
      });

      if (!res || !res.ok) {
        const msg = res?.error || "Erro ao enviar avaliação.";
        // se já avaliou, trava UI também
        if (msg === "ALREADY_RATED") {
          alert("Este candidato já foi avaliado por este jurado. Avaliação travada.");
          markLocked(jur, c.candidateId);
          setLockedUI(true);
          return;
        }
        throw new Error(msg);
      }

      alert(`✅ Avaliação enviada!\nTotal: ${res.total100}/100\nRanking atualizado automaticamente.`);

      // trava local
      markLocked(jur, c.candidateId);
      setLockedUI(true);

    } catch (err) {
      alert(`Erro ao enviar avaliação: ${err.message || err}`);
      btnSend.disabled = false;
      btnSend.textContent = "Finalizar avaliação (enviar)";
    }
  });

  // monta card
  card.appendChild(head);
  card.appendChild(audioBox);
  card.appendChild(evalBox);

  // calcula total inicial
  updateTotal();

  return card;
}

function markLocked(juror, candidateId) {
  const key = `vma_lock_${juror}`;
  const map = JSON.parse(localStorage.getItem(key) || "{}") || {};
  map[candidateId] = true;
  localStorage.setItem(key, JSON.stringify(map));
  lockMap = map;
}

/* =========================
   INIT
========================= */
async function main() {
  CFG = getCfg();

  if (!CFG) {
    alert("Config não carregou: verifique assets/js/vma-config.js no HTML.");
    return;
  }

  bindTopBar();
  initAuthGuard();

  try {
    await loadCandidates();
    renderCandidates();
  } catch (e) {
    console.error(e);
    alert(`Falha ao carregar candidatos: ${e.message || e}`);
  }
}

document.addEventListener("DOMContentLoaded", main);
