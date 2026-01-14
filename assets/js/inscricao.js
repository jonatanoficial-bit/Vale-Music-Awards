import { db } from "./firebase.js";
import {
  doc, getDoc, setDoc, runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// Helpers
function mbToBytes(mb){ return Math.floor(mb * 1024 * 1024); }
function isMp3(file){
  const t = (file.type || "").toLowerCase();
  const n = (file.name || "").toLowerCase();
  return t === "audio/mpeg" || t === "audio/mp3" || n.endsWith(".mp3");
}
function fileToBase64(file){
  return new Promise((resolve, reject)=>{
    const r = new FileReader();
    r.onload = () => {
      const dataUrl = String(r.result || "");
      const base64 = dataUrl.split(",")[1] || "";
      resolve(base64);
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
async function getAudioDurationSeconds(file){
  return new Promise((resolve, reject)=>{
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
      resolve(0); // se falhar, não trava por duração
    };
    a.src = url;
  });
}

// Gera código simples
async function nextCandidateId(){
  // Ex: VMA-0001 baseado no contador
  const statsRef = doc(db, "meta", "stats");
  const configRef = doc(db, "meta", "config");

  const id = await runTransaction(db, async (tx) => {
    const configSnap = await tx.get(configRef);
    const statsSnap = await tx.get(statsRef);

    const max = (configSnap.exists() ? configSnap.data().maxCandidates : window.VMA.LIMITS.MAX_CANDIDATES) || window.VMA.LIMITS.MAX_CANDIDATES;
    const count = (statsSnap.exists() ? statsSnap.data().registrationsCount : 0) || 0;

    if (count >= max) throw new Error("INSCRICOES_ENCERRADAS");

    tx.set(statsRef, { registrationsCount: count + 1 }, { merge: true });

    const num = count + 1;
    const code = `VMA-${String(num).padStart(4,"0")}`;
    return code;
  });

  return id;
}

async function uploadToDrive({ kind, file, candidateCode }){
  const base64 = await fileToBase64(file);

  const res = await fetch(window.VMA.DRIVE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: window.VMA.DRIVE_SECRET,
      kind,
      candidateCode,
      fileName: file.name,
      mimeType: file.type || (kind === "audio" ? "audio/mpeg" : "image/jpeg"),
      base64
    })
  });

  const json = await res.json().catch(()=>null);
  if(!json || !json.ok) throw new Error(json?.error || "Falha ao enviar para o Drive.");
  return json; // {fileId, viewUrl, ucUrl}
}

(function(){
  const form = document.getElementById("registerForm");
  if(!form) return;

  const photoInput = document.getElementById("photoInput");
  const audioInput = document.getElementById("audioInput");

  form.addEventListener("submit", async (e)=>{
    e.preventDefault();

    try{
      const fd = new FormData(form);

      const nome = String(fd.get("nome")||"").trim();
      const nomeArtistico = String(fd.get("nomeArtistico")||"").trim();
      const whats = String(fd.get("whats")||"").trim();
      const email = String(fd.get("email")||"").trim();
      const cidade = String(fd.get("cidade")||"").trim();
      const genero = String(fd.get("genero")||"").trim();
      const bio = String(fd.get("bio")||"").trim();

      const photo = photoInput?.files?.[0] || null;
      const audio = audioInput?.files?.[0] || null;

      if(!nome || !nomeArtistico || !whats || !email || !cidade || !genero) {
        alert("Preencha todos os campos obrigatórios.");
        return;
      }
      if(!photo || !audio){
        alert("Envie uma FOTO e um ÁUDIO.");
        return;
      }

      // Validações
      const maxPhoto = mbToBytes(window.VMA.LIMITS.MAX_PHOTO_MB);
      if(photo.size > maxPhoto){
        alert(`Foto muito grande. Máximo: ${window.VMA.LIMITS.MAX_PHOTO_MB}MB`);
        return;
      }

      const maxAudio = mbToBytes(window.VMA.LIMITS.MAX_AUDIO_MB);
      if(audio.size > maxAudio){
        alert(`Áudio muito grande. Máximo: ${window.VMA.LIMITS.MAX_AUDIO_MB}MB`);
        return;
      }
      if(!isMp3(audio)){
        alert("O áudio deve ser MP3.");
        return;
      }

      // Duração (quando o navegador conseguir ler metadata)
      const dur = await getAudioDurationSeconds(audio);
      if(dur && dur > window.VMA.LIMITS.MAX_AUDIO_SECONDS){
        alert(`Áudio muito longo. Máximo: ${Math.floor(window.VMA.LIMITS.MAX_AUDIO_SECONDS/60)} minutos.`);
        return;
      }

      // 1) Reserva vaga e gera código (trava 100)
      const candidateId = await nextCandidateId();

      // 2) Envia arquivos para Drive
      const [photoUp, audioUp] = await Promise.all([
        uploadToDrive({ kind:"photo", file:photo, candidateCode:candidateId }),
        uploadToDrive({ kind:"audio", file:audio, candidateCode:candidateId }),
      ]);

      // 3) Salva candidato no Firestore
      const candRef = doc(db, "candidates", candidateId);
      await setDoc(candRef, {
        id: candidateId,
        nome,
        nomeArtistico,
        contato: { whats, email },
        cidade,
        genero,
        bio,
        createdAt: serverTimestamp(),
        photo: { fileId: photoUp.fileId, ucUrl: photoUp.ucUrl, viewUrl: photoUp.viewUrl },
        audio: { fileId: audioUp.fileId, ucUrl: audioUp.ucUrl, viewUrl: audioUp.viewUrl },
        avgScore100: 0,
        scoresCount: 0
      }, { merge: true });

      alert(`Inscrição concluída! Seu código é: ${candidateId}`);
      window.location.href = "./candidato.html";
    }catch(err){
      const msg = String(err?.message || err || "");
      if(msg.includes("INSCRICOES_ENCERRADAS")){
        alert("Inscrições encerradas: limite máximo atingido.");
      }else{
        alert("Erro ao concluir inscrição: " + msg);
      }
    }
  });
})();
