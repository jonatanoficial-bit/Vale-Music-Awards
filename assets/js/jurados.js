// assets/js/jurados.js
import { VMA_CONFIG } from "./vma-config.js";
import { VMA_API } from "./vma-api.js";

const jurorSelect = document.getElementById("jurorSelect");
const jurorPin = document.getElementById("jurorPin");
const btnLogin = document.getElementById("btnLogin");
const btnLogout = document.getElementById("btnLogout");
const loginStatus = document.getElementById("loginStatus");

const candList = document.getElementById("candList");
const viewer = document.getElementById("viewer");

let state = {
  juror: null,
  candidates: [],
  selected: null
};

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (m) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function ratedKey(jurorId) {
  return `vma_rated_${jurorId}`;
}

function getRatedSet(jurorId) {
  const raw = localStorage.getItem(ratedKey(jurorId)) || "[]";
  try {
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function addRated(jurorId, candidateId) {
  const set = getRatedSet(jurorId);
  set.add(candidateId);
  localStorage.setItem(ratedKey(jurorId), JSON.stringify([...set]));
}

function isRated(jurorId, candidateId) {
  const set = getRatedSet(jurorId);
  return set.has(candidateId);
}

function renderJurors() {
  jurorSelect.innerHTML = VMA_CONFIG.jurors
    .map(j => `<option value="${esc(j.id)}">${esc(j.name)}</option>`)
    .join("");
}

function setLoggedInUI(isLogged) {
  btnLogin.style.display = isLogged ? "none" : "inline-flex";
  btnLogout.style.display = isLogged ? "inline-flex" : "none";
  jurorSelect.disabled = isLogged;
  jurorPin.disabled = isLogged;
}

function getSelectedJuror() {
  const id = jurorSelect.value;
  return VMA_CONFIG.jurors.find(j => j.id === id) || null;
}

function saveSession(juror) {
  sessionStorage.setItem("vma_juror", JSON.stringify({ id: juror.id, name: juror.name }));
}

function loadSession() {
  const raw = sessionStorage.getItem("vma_juror");
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (!obj?.id) return null;
    return VMA_CONFIG.jurors.find(j => j.id === obj.id) || null;
  } catch {
    return null;
  }
}

function clearSession() {
  sessionStorage.removeItem("vma_juror");
}

function candidateCard(c) {
  const name = c.artisticName || c.name || c.candidateId;
  const photo = c.photoUrl || "../assets/img/vale-producao-logo.png";
  const avg = Number(c.avgScore100 || 0).toFixed(2);
  const count = Number(c.scoresCount || 0);

  const rated = state.juror && isRated(state.juror.id, c.candidateId);
  const badge = rated ? `<span class="pill">✅ Avaliado</span>` : `<span class="pill">Pendente</span>`;

  const active = state.selected && state.selected.candidateId === c.candidateId ? "active" : "";
  return `
    <div class="cand ${active}" data-id="${esc(c.candidateId)}">
      <img src="${esc(photo)}" alt="${esc(name)}" loading="lazy" />
      <div>
        <div class="name">${esc(name)}</div>
        <div class="muted" style="font-size:.9rem">${esc(c.candidateId)} • média ${esc(avg)} • ${count} nota(s)</div>
      </div>
      <div class="right">${badge}</div>
    </div>
  `;
}

function renderCandidates() {
  if (!state.juror) {
    candList.innerHTML = `<div class="lock">Faça login para carregar os candidatos.</div>`;
    return;
  }
  if (!state.candidates.length) {
    candList.innerHTML = `<div class="lock">Ainda não há candidatos enviados pelo Forms.</div>`;
    return;
  }
  candList.innerHTML = state.candidates.map(candidateCard).join("");

  candList.querySelectorAll(".cand").forEach(el => {
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-id");
      const c = state.candidates.find(x => x.candidateId === id);
      if (!c) return;
      state.selected = c;
      renderCandidates();
      renderViewer();
    });
  });
}

function renderViewer() {
  if (!state.juror) {
    viewer.innerHTML = `<div class="lock">Faça login para avaliar.</div>`;
    return;
  }
  if (!state.selected) {
    viewer.innerHTML = `<div class="lock">Selecione um candidato para começar.</div>`;
    return;
  }

  const c = state.selected;
  const name = c.artisticName || c.name || c.candidateId;
  const photo = c.photoUrl || "../assets/img/vale-producao-logo.png";
  const audio = c.audioUrl || "";

  const locked = isRated(state.juror.id, c.candidateId);

  const critRows = VMA_CONFIG.criteria.map((cr, idx) => `
    <div class="crit">
      <div>
        <div style="font-weight:900">${esc(cr.label)}</div>
        <div class="muted" style="font-size:.9rem">0 a 10</div>
      </div>
      <input ${locked ? "disabled" : ""} type="number" min="0" max="10" step="1" value="0" data-idx="${idx}" />
    </div>
  `).join("");

  viewer.innerHTML = `
    <div class="hero">
      <img src="${esc(photo)}" alt="${esc(name)}" />
      <div>
        <div class="title">${esc(name)}</div>
        <div class="sub">${esc(c.candidateId)} • ${esc(c.city || "")} • ${esc(c.genre || "")}</div>
      </div>
      <div style="margin-left:auto" class="pill">Nota final: <strong id="total100" style="margin-left:6px">0</strong>/100</div>
    </div>

    <div class="panel" style="padding:12px">
      <div class="muted" style="margin-bottom:10px">Áudio enviado</div>
      ${audio ? `<audio controls src="${esc(audio)}"></audio>` : `<div class="lock">Sem áudio disponível.</div>`}
    </div>

    <div class="criteria" id="criteriaBox">
      ${critRows}
    </div>

    <div class="sum">
      <div>
        <div class="muted">Soma automática (0–100)</div>
        <strong id="sumText">0</strong>
      </div>
      <button class="btn" id="btnSubmit" ${locked ? "disabled" : ""}>Enviar avaliação (travar)</button>
    </div>

    ${locked ? `<div class="lock">✅ Esta avaliação já foi enviada e está travada neste dispositivo.</div>` : ""}
    <div class="pill" id="submitStatus">Pronto para avaliar.</div>
  `;

  const inputs = viewer.querySelectorAll('#criteriaBox input[type="number"]');
  const sumText = viewer.querySelector("#sumText");
  const total100 = viewer.querySelector("#total100");
  const btnSubmit = viewer.querySelector("#btnSubmit");
  const submitStatus = viewer.querySelector("#submitStatus");

  function calcSum() {
    let sum = 0;
    inputs.forEach(inp => {
      let n = Number(inp.value);
      if (!Number.isFinite(n)) n = 0;
      if (n < 0) n = 0;
      if (n > 10) n = 10;
      inp.value = String(Math.round(n));
      sum += Number(inp.value);
    });
    sumText.textContent = String(sum);
    total100.textContent = String(sum);
    return sum;
  }

  inputs.forEach(inp => inp.addEventListener("input", calcSum));
  calcSum();

  if (btnSubmit) {
    btnSubmit.addEventListener("click", async () => {
      try {
        const sum = calcSum();
        const scores = Array.from(inputs).map(i => Number(i.value));

        btnSubmit.disabled = true;
        submitStatus.textContent = "Enviando…";

        const res = await VMA_API.rate({
          jurorId: state.juror.id,
          candidateId: c.candidateId,
          scores
        });

        // trava localmente + UI
        addRated(state.juror.id, c.candidateId);

        submitStatus.textContent = `✅ Enviado! Nota final: ${res.total100}/100 (travado)`;

        // desabilita inputs
        inputs.forEach(i => i.disabled = true);

        // recarrega candidatos pra mostrar badge
        await loadCandidates();
        renderCandidates();

      } catch (e) {
        submitStatus.textContent = `Erro: ${e.message}`;
        // Se já avaliou em outro dispositivo, o servidor retorna ALREADY_RATED
        // mantemos travado local apenas se você quiser:
        if (String(e.message || "").includes("ALREADY_RATED")) {
          addRated(state.juror.id, c.candidateId);
          renderCandidates();
          renderViewer();
        } else {
          btnSubmit.disabled = false;
        }
      }
    });
  }
}

async function loadCandidates() {
  const data = await VMA_API.candidates();
  state.candidates = data.candidates || [];
}

async function onLogin() {
  const juror = getSelectedJuror();
  const pin = String(jurorPin.value || "").trim();
  if (!juror) {
    loginStatus.textContent = "Selecione um jurado.";
    return;
  }
  if (pin !== juror.pin) {
    loginStatus.textContent = "PIN incorreto.";
    return;
  }

  state.juror = juror;
  saveSession(juror);
  setLoggedInUI(true);
  loginStatus.textContent = `✅ Logado como ${juror.name}. Carregando candidatos…`;

  try {
    await loadCandidates();
    loginStatus.textContent = "Pronto. Selecione um candidato.";
  } catch (e) {
    loginStatus.textContent = `Erro ao carregar candidatos: ${e.message}`;
  }

  renderCandidates();
  renderViewer();
}

function onLogout() {
  state.juror = null;
  state.selected = null;
  clearSession();
  setLoggedInUI(false);
  loginStatus.textContent = "Aguardando login…";
  jurorPin.value = "";
  renderCandidates();
  renderViewer();
}

function boot() {
  renderJurors();

  // auto-login
  const sess = loadSession();
  if (sess) {
    state.juror = sess;
    setLoggedInUI(true);
    loginStatus.textContent = `✅ Logado como ${sess.name}. Carregando candidatos…`;
    loadCandidates()
      .then(() => {
        loginStatus.textContent = "Pronto. Selecione um candidato.";
        renderCandidates();
        renderViewer();
      })
      .catch((e) => {
        loginStatus.textContent = `Erro ao carregar candidatos: ${e.message}`;
        renderCandidates();
        renderViewer();
      });
  } else {
    setLoggedInUI(false);
    renderCandidates();
    renderViewer();
  }

  btnLogin.addEventListener("click", onLogin);
  btnLogout.addEventListener("click", onLogout);

  // Enter para logar
  jurorPin.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") onLogin();
  });
}

boot();
