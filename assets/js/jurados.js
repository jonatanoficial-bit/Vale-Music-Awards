import { auth, db } from "./firebase.js";

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  collection,
  getDocs,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/**
 * Jurados • Vale Music Awards
 * - Login via Firebase Auth
 * - Lista candidatos (Firestore)
 * - Avaliação técnica 10 critérios (0-10)
 * - Soma automática 0-100
 * - Travar após finalizar
 * - Atualiza média do candidato no ranking
 */

function clamp10(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(10, n));
}

function calcTotal100(scores) {
  // 10 critérios x 0-10 => 0-100
  return window.VMA.CRITERIA.reduce((sum, c) => sum + clamp10(scores[c.key]), 0);
}

async function loadCandidates() {
  // Ordena por data (últimos primeiro). Ranking é calculado em outro lugar.
  const q = query(collection(db, "candidates"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

async function getLockedScore(candidateId, judgeUid) {
  const scoreId = `${candidateId}__${judgeUid}`;
  const ref = doc(db, "scores", scoreId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

function renderLogin(mount) {
  mount.innerHTML = `
    <div style="display:grid;gap:10px">
      <b>Login de Jurado</b>
      <p style="color:var(--muted);margin:0">
        Acesso restrito do Vale Music Awards.
      </p>

      <input id="email" type="email" placeholder="email"
        style="padding:12px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.30);color:var(--text)" />

      <input id="pass" type="password" placeholder="senha"
        style="padding:12px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.30);color:var(--text)" />

      <button class="btn btn--gold" id="btnLogin">Entrar</button>

      <div style="color:var(--muted2);font-size:12px">
        Dica: crie 5 usuários de jurado em Firebase Authentication (Email/Senha).
      </div>
    </div>
  `;

  mount.querySelector("#btnLogin").onclick = async () => {
    const email = String(mount.querySelector("#email").value || "").trim();
    const pass = String(mount.querySelector("#pass").value || "").trim();
    if (!email || !pass) return alert("Informe email e senha.");

    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (e) {
      alert("Falha no login: " + (e?.message || e));
    }
  };
}

function scoreFormHTML(candidate) {
  const crit = window.VMA.CRITERIA.map(
    (c) => `
    <div class="tile" style="padding:12px">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
        <b>${c.label}</b>
        <span style="color:var(--muted2);font-size:12px">0 a 10</span>
      </div>
      <input data-k="${c.key}" type="range" min="0" max="10" step="1" value="8"
        style="width:100%;margin-top:10px">
      <div style="display:flex;justify-content:space-between;color:var(--muted2);font-size:12px;margin-top:6px">
        <span>0</span><span>10</span>
      </div>
    </div>
  `
  ).join("");

  const photoUrl = candidate?.photo?.url || "";
  const audioUrl = candidate?.audio?.url || "";

  return `
    <div class="card" style="padding:16px;margin-top:12px">
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <img src="${photoUrl}" alt="Foto do candidato"
          style="width:64px;height:64px;border-radius:18px;object-fit:cover;border:1px solid rgba(255,255,255,.10)"/>
        <div style="flex:1">
          <div style="font-weight:950;font-size:18px">${candidate.nomeArtistico || candidate.nome}</div>
          <div style="color:var(--muted)">${candidate.id} • ${candidate.genero} • ${candidate.cidade}</div>
        </div>
      </div>

      <div style="margin-top:12px">
        <b>Áudio</b>
        <div style="margin-top:8px">
          <audio controls style="width:100%">
            <source src="${audioUrl}" type="audio/mpeg">
          </audio>
        </div>
      </div>

      <div style="margin-top:14px">
        <b>Avaliação técnica</b>
        <div style="color:var(--muted);margin-top:6px">
          Preencha os critérios (0–10). A nota final (0–100) é calculada automaticamente.
        </div>

        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:12px" class="critgrid">
          ${crit}
        </div>

        <div class="card" style="padding:14px;margin-top:12px;border:1px solid rgba(245,211,106,.35)">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
            <div>
              <div style="font-weight:900">Nota final</div>
              <div style="color:var(--muted2);font-size:12px">0 a 100 • soma automática</div>
            </div>
            <div style="font-weight:950;font-size:34px;background:linear-gradient(90deg,var(--gold1),var(--gold2));-webkit-background-clip:text;color:transparent" id="total100">80</div>
          </div>
        </div>

        <textarea id="note" rows="3" placeholder="Feedback (opcional)"
          style="margin-top:10px;width:100%;padding:12px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.30);color:var(--text)"></textarea>

        <button class="btn btn--gold btn--block" id="finalize" style="margin-top:12px">
          Finalizar avaliação (travada)
        </button>

        <div style="color:var(--muted2);font-size:12px;margin-top:10px">
          Ao finalizar, esta avaliação fica <b>bloqueada</b> e não poderá ser alterada.
        </div>
      </div>
    </div>
  `;
}

function wireTotalCalc(root) {
  const totalEl = root.querySelector("#total100");
  const sliders = [...root.querySelectorAll('input[type="range"][data-k]')];

  function recompute() {
    const scores = {};
    for (const s of sliders) scores[s.dataset.k] = Number(s.value);
    totalEl.textContent = String(calcTotal100(scores));
  }

  sliders.forEach((s) => s.addEventListener("input", recompute));
  recompute();
}

async function finalizeScore(candidateId, judgeUid, scores, note) {
  const scoreId = `${candidateId}__${judgeUid}`;
  const scoreRef = doc(db, "scores", scoreId);
  const candRef = doc(db, "candidates", candidateId);

  const total100 = calcTotal100(scores);

  await runTransaction(db, async (tx) => {
    const existing = await tx.get(scoreRef);
    if (existing.exists()) {
      throw new Error("Esta avaliação já foi finalizada e está travada.");
    }

    // Salva score travado
    tx.set(scoreRef, {
      candidateId,
      judgeUid,
      scores,
      total100,
      note: String(note || "").trim(),
      locked: true,
      createdAt: serverTimestamp(),
    });

    // Atualiza média do candidato
    const candSnap = await tx.get(candRef);
    const cand = candSnap.exists() ? candSnap.data() : null;

    const oldCount = Number(cand?.scoresCount || 0);
    const oldAvg = Number(cand?.avgScore100 || 0);

    const newCount = oldCount + 1;
    const newAvg = ((oldAvg * oldCount) + total100) / newCount;

    tx.set(
      candRef,
      {
        avgScore100: newAvg,
        scoresCount: newCount,
      },
      { merge: true }
    );
  });

  return total100;
}

function renderLockedView(candidate, locked) {
  const photoUrl = candidate?.photo?.url || "";
  const audioUrl = candidate?.audio?.url || "";

  return `
    <div class="card" style="padding:16px;margin-top:12px">
      <b>Avaliação finalizada (travada)</b>
      <div style="color:var(--muted);margin-top:6px">
        Você já finalizou esta avaliação e não pode editar.
      </div>

      <div style="display:flex;gap:12px;align-items:center;margin-top:12px;flex-wrap:wrap">
        <img src="${photoUrl}" alt="Foto do candidato"
          style="width:64px;height:64px;border-radius:18px;object-fit:cover;border:1px solid rgba(255,255,255,.10)"/>
        <div style="flex:1">
          <div style="font-weight:950;font-size:18px">${candidate.nomeArtistico || candidate.nome}</div>
          <div style="color:var(--muted)">${candidate.id} • ${candidate.genero} • ${candidate.cidade}</div>
        </div>
        <div style="font-weight:950;font-size:34px;background:linear-gradient(90deg,var(--gold1),var(--gold2));-webkit-background-clip:text;color:transparent">
          ${Number(locked.total100 || 0)}
        </div>
      </div>

      <div style="margin-top:12px">
        <b>Áudio</b>
        <div style="margin-top:8px">
          <audio controls style="width:100%">
            <source src="${audioUrl}" type="audio/mpeg">
          </audio>
        </div>
      </div>

      <div style="margin-top:12px">
        <b>Critérios</b>
        <div style="margin-top:10px;display:grid;grid-template-columns:repeat(2,1fr);gap:10px">
          ${window.VMA.CRITERIA.map(
            (cr) => `
            <div class="tile" style="padding:12px">
              <b>${cr.label}</b>
              <div style="margin-top:6px;color:var(--muted)">
                Nota: <b>${Number(locked?.scores?.[cr.key] ?? 0)}</b> / 10
              </div>
            </div>
          `
          ).join("")}
        </div>
      </div>

      ${
        locked.note
          ? `<div style="margin-top:12px"><b>Feedback</b><div style="color:var(--muted);margin-top:6px">${locked.note}</div></div>`
          : ""
      }
    </div>
  `;
}

async function renderPanel(mount, user) {
  const candidates = await loadCandidates();

  mount.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">
      <div>
        <b>Painel de Jurado</b>
        <div style="color:var(--muted);margin-top:4px">${window.VMA.FESTIVAL_NAME} • avaliações travadas</div>
      </div>
      <button class="btn btn--ghost" id="logout">Sair</button>
    </div>

    <div class="card" style="padding:14px;margin-top:12px">
      <b>Candidatos</b>
      <div style="color:var(--muted);margin-top:6px">
        Selecione um candidato para avaliar. Se já foi avaliado, ficará somente leitura.
      </div>

      <select id="selCand"
        style="margin-top:10px;width:100%;padding:12px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.30);color:var(--text)">
        ${
          candidates.length
            ? candidates
                .map((c) => `<option value="${c.id}">${c.id} • ${c.nomeArtistico || c.nome}</option>`)
                .join("")
            : `<option value="" disabled selected>Nenhum candidato inscrito ainda</option>`
        }
      </select>
    </div>

    <div id="candidateArea"></div>
  `;

  mount.querySelector("#logout").onclick = async () => {
    await signOut(auth);
  };

  const sel = mount.querySelector("#selCand");
  const area = mount.querySelector("#candidateArea");

  async function showCandidate(id) {
    const cand = candidates.find((c) => c.id === id);
    if (!cand) {
      area.innerHTML = "";
      return;
    }

    const locked = await getLockedScore(cand.id, user.uid);

    if (locked) {
      area.innerHTML = renderLockedView(cand, locked);
      return;
    }

    // Ainda não avaliado
    area.innerHTML = scoreFormHTML(cand);
    wireTotalCalc(area);

    area.querySelector("#finalize").onclick = async () => {
      const sliders = [...area.querySelectorAll('input[type="range"][data-k]')];
      const scores = {};
      for (const s of sliders) scores[s.dataset.k] = Number(s.value);
      const note = area.querySelector("#note").value || "";

      if (!confirm("Finalizar avaliação? Após confirmar, não será possível alterar.")) return;

      try {
        const total100 = await finalizeScore(cand.id, user.uid, scores, note);
        alert(`Avaliação finalizada! Nota final: ${total100}/100`);

        // Recarrega vista travada
        const lockedNow = await getLockedScore(cand.id, user.uid);
        area.innerHTML = renderLockedView(cand, lockedNow);
      } catch (e) {
        alert(String(e?.message || e));
      }
    };
  }

  if (candidates.length) {
    sel.addEventListener("change", () => showCandidate(sel.value));
    await showCandidate(sel.value);
  } else {
    area.innerHTML = `<div class="card" style="padding:16px;margin-top:12px">Nenhum candidato cadastrado ainda.</div>`;
  }
}

(function () {
  const mount = document.getElementById("judgeBox");
  if (!mount) return;

  onAuthStateChanged(auth, (user) => {
    if (!user) renderLogin(mount);
    else renderPanel(mount, user);
  });
})();
