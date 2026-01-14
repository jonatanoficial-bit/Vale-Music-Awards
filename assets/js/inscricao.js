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
 * Inscrição:
 * - Reserva vaga com contador no Firestore (meta/stats)
 * - Cria ID VMA-0001 etc
 * - Faz upload (foto+mp3) no Firebase Storage
 * - Salva candidato em "candidates"
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

    const max =
      (configSnap.exists() ? Number(configSnap.data().maxCandidates) : Number(window.VMA?.LIMITS?.MAX_CANDIDATES)) ||
      100;

    const count =
      (statsSnap.exists() ? Number(statsSnap.data().registrationsCount) : 0) || 0;

    if (count >= max) throw new Error("INSCRICOES_ENCERRADAS");

    tx.set(statsRef, { registrationsCount: count + 1 }, { merge: true });

    const num = count + 1;
    return `VMA-${String(num).padStart(4, "0")}`;
  });

  return id;
}

async function uploadToStorage(candidateId, kind, file) {
  // submissions/VMA-0001/photo.jpg
  // submissions/VMA-0001/audio.mp3
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

(function () {
  const form = document.getElementById("registerForm");
  if (!form) return;

  const photoInput = document.getElementById("photoInput");
  const audioInput = document.getElementById("audioInput");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      // Garantia: config carregado
      if (!window.VMA || window.VMA.UPLOAD_PROVIDER !== "firebase") {
        alert("Configuração inválida: UPLOAD_PROVIDER não está como 'firebase'. Verifique o vma-config.js.");
        return;
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
        alert("Preencha todos os campos obrigatórios.");
        return;
      }
      if (!photo || !audio) {
        alert("Envie uma FOTO e um ÁUDIO.");
        return;
      }

      // Limites
      const maxPhotoBytes = mbToBytes(Number(window.VMA.LIMITS.MAX_PHOTO_MB));
      if (photo.size > maxPhotoBytes) {
        alert(`Foto muito grande. Máximo: ${window.VMA.LIMITS.MAX_PHOTO_MB}MB`);
        return;
      }

      const maxAudioBytes = mbToBytes(Number(window.VMA.LIMITS.MAX_AUDIO_MB));
      if (audio.size > maxAudioBytes) {
        alert(`Áudio muito grande. Máximo: ${window.VMA.LIMITS.MAX_AUDIO_MB}MB`);
        return;
      }

      if (!isMp3(audio)) {
        alert("O áudio deve ser MP3.");
        return;
      }

      const dur = await getAudioDurationSeconds(audio);
      if (dur && dur > Number(window.VMA.LIMITS.MAX_AUDIO_SECONDS)) {
        alert(`Áudio muito longo. Máximo: ${Math.floor(Number(window.VMA.LIMITS.MAX_AUDIO_SECONDS) / 60)} minutos.`);
        return;
      }

      // 1) Reserva vaga e gera código
      const candidateId = await nextCandidateId();

      // 2) Upload Storage
      const [photoUp, audioUp] = await Promise.all([
        uploadToStorage(candidateId, "photo", photo),
        uploadToStorage(candidateId, "audio", audio),
      ]);

      // 3) Firestore candidato
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

      alert(`Inscrição concluída! Seu código é: ${candidateId}`);
      window.location.href = "./candidato.html";
    } catch (err) {
      const msg = String(err?.message || err || "");
      if (msg.includes("INSCRICOES_ENCERRADAS")) {
        alert("Inscrições encerradas: limite máximo atingido.");
      } else {
        alert("Erro ao concluir inscrição: " + msg);
      }
    }
  });
})();
