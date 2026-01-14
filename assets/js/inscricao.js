// assets/js/inscricao.js
import { db, storage } from "./firebase.js";

import {
  doc,
  setDoc,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

/**
 * Inscrição (modo confiável):
 * - Gera ID VMA-0001... via meta/stats
 * - Upload foto+mp3 no Firebase Storage
 * - Salva dados no Firestore /candidates/{id}
 * - SEMPRE dá feedback (botão e alerts)
 */

function mbToBytes(mb) {
  return Math.floor(mb * 1024 * 1024);
}

function isMp3(file) {
  const t = (file.type || "").toLowerCase();
  const n = (file.name || "").toLowerCase();
  return t === "audio/mpeg" || t === "audio/mp3" || n.endsWith(".mp3");
}

function getExt(fileName, fallback) {
  const n = (fileName || "").toLowerCase();
  if (n.endsWith(".mp3")) return "mp3";
  if (n.endsWith(".png")) return "png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "jpg";
  return fallback;
}

async function getAudioDurationSeconds(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    a.preload = "metadata";
    a.onloadedmetadata = () => {
      const d = a.duration;
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(d) ? d : 0);
    };
    a.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    a.src = url;
  });
}

async function nextCandidateId() {
  const statsRef = doc(db, "meta", "stats");
  const configRef = doc(db, "meta", "config");

  const id = await runTransaction(db, async (tx) => {
    const configSnap = await tx.get(configRef);
    const statsSnap = await tx.get(statsRef);

    if (!configSnap.exists()) {
      throw new Error("Firestore: faltou criar meta/config (maxCandidates).");
    }
    if (!statsSnap.exists()) {
      throw new Error("Firestore: faltou criar meta/stats (registrationsCount).");
    }

    const max = Number(configSnap.data().maxCandidates || 100);
    const count = Number(statsSnap.data().registrationsCount || 0);

    if (count >= max) throw new Error("INSCRICOES_ENCERRADAS");

    tx.set(statsRef, { registrationsCount: count + 1 }, { merge: true });

    const num = count + 1;
    return `VMA-${String(num).padStart(4, "0")}`;
  });

  return id;
}

async function uploadToStorage(candidateId, kind, file) {
  const ext = kind === "audio" ? "mp3" : getExt(file.name, "jpg");
  const path = `submissions/${candidateId}/${kind}.${ext}`;

  const r = ref(storage, path);

  const metadata = {
    contentType:
      file.type ||
      (kind === "audio" ? "audio/mpeg" : "image/jpeg"),
  };

  await uploadBytes(r, file, metadata);
  const url = await getDownloadURL(r);
  return { path, url };
}

function setBusy(btn, busy, text) {
  if (!btn) return;
  btn.disabled = !!busy;
  btn.style.opacity = busy ? "0.7" : "1";
  btn.textContent = text || (busy ? "Enviando..." : "Concluir inscrição");
}

(function () {
  const form = document.getElementById("registerForm");
  if (!form) return;

  const photoInput = document.getElementById("photoInput");
  const audioInput = document.getElementById("audioInput");
  const submitBtn = form.querySelector('button[type="submit"]');

  // Marca clara de que o script carregou
  console.log("[VMA] inscricao.js carregado ✔");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    setBusy(submitBtn, true, "Enviando...");

    try {
      if (!window.VMA) {
        throw new Error("Config não carregou: verifique assets/js/vma-config.js no HTML.");
      }
      if (window.VMA.UPLOAD_PROVIDER !== "firebase") {
        throw new Error("UPLOAD_PROVIDER não está 'firebase'. Ajuste vma-config.js.");
      }

      const fd = new FormData(form);

      const nome = String(fd.get("nome") || "").trim();
      const nomeArtistico = String(fd.get("nomeArtistico") || "").trim();
      const whats = String(fd.get("whats") || "").trim();
      const email = String(fd.get("email") || "").trim();
      const cidade = String(fd.get("cidade") || "").trim();
      const genero = String(fd.get("genero") || "").trim();
      const bio = String(fd.get("bio") || "").trim();

      const photo = photoInput?.files?.[0] || null;
      const audio = audioInput?.files?.[0] || null;

      if (!nome || !nomeArtistico || !whats || !email || !cidade || !genero) {
        throw new Error("Preencha todos os campos obrigatórios.");
      }
      if (!photo || !audio) {
        throw new Error("Envie uma FOTO e um ÁUDIO.");
      }

      const maxPhotoBytes = mbToBytes(Number(window.VMA.LIMITS.MAX_PHOTO_MB));
      if (photo.size > maxPhotoBytes) {
        throw new Error(`Foto muito grande. Máximo: ${window.VMA.LIMITS.MAX_PHOTO_MB}MB`);
      }

      const maxAudioBytes = mbToBytes(Number(window.VMA.LIMITS.MAX_AUDIO_MB));
      if (audio.size > maxAudioBytes) {
        throw new Error(`Áudio muito grande. Máximo: ${window.VMA.LIMITS.MAX_AUDIO_MB}MB`);
      }
      if (!isMp3(audio)) {
        throw new Error("O áudio deve ser MP3.");
      }

      const dur = await getAudioDurationSeconds(audio);
      if (dur && dur > Number(window.VMA.LIMITS.MAX_AUDIO_SECONDS)) {
        throw new Error(`Áudio muito longo. Máximo: ${Math.floor(Number(window.VMA.LIMITS.MAX_AUDIO_SECONDS) / 60)} minutos.`);
      }

      console.log("[VMA] Gerando ID...");
      const candidateId = await nextCandidateId();
      console.log("[VMA] ID gerado:", candidateId);

      console.log("[VMA] Upload Storage (foto e áudio)...");
      const [photoUp, audioUp] = await Promise.all([
        uploadToStorage(candidateId, "photo", photo),
        uploadToStorage(candidateId, "audio", audio),
      ]);

      console.log("[VMA] Upload concluído:", { photoUp, audioUp });

      console.log("[VMA] Salvando no Firestore...");
      await setDoc(
        doc(db, "candidates", candidateId),
        {
          id: candidateId,
          nome,
          nomeArtistico,
          contato: { whats, email },
          cidade,
          genero,
          bio,
          createdAt: serverTimestamp(),
          photo: { url: photoUp.url, path: photoUp.path },
          audio: { url: audioUp.url, path: audioUp.path },
          avgScore100: 0,
          scoresCount: 0,
        },
        { merge: true }
      );

      console.log("[VMA] Firestore OK ✔");
      alert(`Inscrição concluída! Seu código é: ${candidateId}`);

      form.reset();
      setBusy(submitBtn, false, "Concluir inscrição");
      window.location.href = "./candidato.html";
    } catch (err) {
      const msg = String(err?.message || err || "");
      console.error("[VMA] Erro na inscrição:", err);
      if (msg.includes("INSCRICOES_ENCERRADAS")) {
        alert("Inscrições encerradas: limite máximo atingido.");
      } else {
        alert("Erro ao concluir inscrição: " + msg);
      }
      setBusy(submitBtn, false, "Concluir inscrição");
    }
  });
})();