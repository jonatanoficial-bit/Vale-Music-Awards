// assets/js/inscricao.js
// Fluxo de inscrição (sem Firebase):
// - valida dados
// - exige aceite do regulamento
// - valida tamanho local de foto/áudio (UX)
// - direciona o candidato para o Google Forms (upload real lá)
// - informa claramente o que fazer

import { VMA_CONFIG } from "./vma-config.js";

(function initInscricao() {
  const form = document.getElementById("formInscricao");
  const statusBox = document.getElementById("statusBox");
  const btnEnviar = document.getElementById("btnEnviar");

  if (!form) {
    console.warn("[VMA] formInscricao não encontrado nesta página.");
    return;
  }

  // Mostra aviso se config estiver faltando
  if (!VMA_CONFIG || !VMA_CONFIG.FORMS_URL || !VMA_CONFIG.APPS_SCRIPT_URL) {
    showStatus(
      "Config não carregou: verifique assets/js/vma-config.js e se o script está como type='module'.",
      "error"
    );
    return;
  }

  // Helpers
  function mb(bytes) {
    return bytes / (1024 * 1024);
  }

  function showStatus(message, type = "info") {
    if (!statusBox) {
      alert(message);
      return;
    }
    statusBox.className = `statusbox ${type}`;
    statusBox.textContent = message;
  }

  function setBusy(isBusy) {
    if (!btnEnviar) return;
    btnEnviar.disabled = isBusy;
    btnEnviar.textContent = isBusy ? "Enviando..." : "Concluir inscrição";
  }

  function normalizePhone(s) {
    return String(s || "")
      .replace(/[^\d]+/g, "")
      .slice(0, 20);
  }

  // Validações principais
  function validateForm() {
    const nome = (document.getElementById("nome")?.value || "").trim();
    const artistico = (document.getElementById("artistico")?.value || "").trim();
    const whats = (document.getElementById("whats")?.value || "").trim();
    const email = (document.getElementById("email")?.value || "").trim();
    const cidade = (document.getElementById("cidade")?.value || "").trim();
    const genero = (document.getElementById("genero")?.value || "").trim();
    const bio = (document.getElementById("bio")?.value || "").trim();
    const aceite = !!document.getElementById("aceite")?.checked;

    const fotoInput = document.getElementById("foto");
    const audioInput = document.getElementById("audio");

    const fotoFile = fotoInput?.files?.[0] || null;
    const audioFile = audioInput?.files?.[0] || null;

    if (!nome || nome.length < 3) return { ok: false, error: "Informe seu nome completo." };
    if (!artistico || artistico.length < 2) return { ok: false, error: "Informe seu nome artístico." };
    if (!whats || normalizePhone(whats).length < 10) return { ok: false, error: "Informe um WhatsApp válido." };
    if (!email || !email.includes("@")) return { ok: false, error: "Informe um e-mail válido." };
    if (!cidade) return { ok: false, error: "Informe Cidade / Estado." };
    if (!genero) return { ok: false, error: "Selecione o gênero musical." };
    if (!aceite) return { ok: false, error: "Você precisa aceitar o Regulamento Oficial para continuar." };

    // Validação local (UX). O upload REAL vai ocorrer no Forms.
    if (fotoFile) {
      const maxPhoto = VMA_CONFIG.LIMITS.PHOTO_MAX_MB;
      if (mb(fotoFile.size) > maxPhoto) {
        return { ok: false, error: `Foto acima do limite (${maxPhoto}MB). Escolha outra foto.` };
      }
      if (!String(fotoFile.type || "").startsWith("image/")) {
        return { ok: false, error: "A foto precisa ser um arquivo de imagem (JPG/PNG)." };
      }
    } else {
      return { ok: false, error: "Selecione uma foto do seu rosto." };
    }

    if (audioFile) {
      const maxAudio = VMA_CONFIG.LIMITS.AUDIO_MAX_MB;
      const t = String(audioFile.type || "").toLowerCase();
      const n = String(audioFile.name || "").toLowerCase();
      const isMp3 = t.includes("mpeg") || t.includes("mp3") || n.endsWith(".mp3");
      if (!isMp3) {
        return { ok: false, error: "O áudio precisa ser MP3 (.mp3)." };
      }
      if (mb(audioFile.size) > maxAudio) {
        return { ok: false, error: `Áudio acima do limite (${maxAudio}MB). Envie um MP3 menor.` };
      }
    } else {
      return { ok: false, error: "Selecione um áudio MP3." };
    }

    // OK
    return {
      ok: true,
      payload: { nome, artistico, whats, email, cidade, genero, bio }
    };
  }

  // Ao enviar, a gente direciona pro Forms (upload real lá)
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();

    showStatus("", "info");

    const v = validateForm();
    if (!v.ok) {
      showStatus(v.error, "error");
      return;
    }

    setBusy(true);

    try {
      // Importante: arquivos não podem ser enviados pelo site para Google Forms “normal” com JS
      // (principalmente em hospedagem estática). Então o site vira um “pré-cadastro + direcionamento”.
      //
      // O candidato fará o envio final no Forms (que já está com upload e já grava na planilha).
      //
      // Para deixar “profissional”, exibimos um resumo e abrimos o Forms.

      const { nome, artistico, whats, email, cidade, genero } = v.payload;

      const msg =
        "✅ Pré-inscrição validada!\n\n" +
        "Agora você será direcionado ao formulário oficial para:\n" +
        "• anexar sua FOTO e seu ÁUDIO (MP3)\n" +
        "• finalizar sua participação\n\n" +
        "Dica: use os mesmos dados preenchidos aqui para evitar divergências.";

      // Mostra no status e também alert
      showStatus(msg.replace(/\n/g, " "), "success");
      alert(msg);

      // Abre o Forms (o upload real acontece nele)
      window.open(VMA_CONFIG.FORMS_URL, "_blank", "noopener,noreferrer");

      // Limpa e finaliza
      form.reset();
      showStatus(
        "Formulário oficial aberto em outra aba. Após enviar por lá, seu candidato aparecerá no ranking quando o sistema processar.",
        "success"
      );
    } catch (err) {
      console.error(err);
      showStatus("Erro inesperado ao iniciar inscrição. Tente novamente.", "error");
    } finally {
      setBusy(false);
    }
  });

  // Mensagem inicial
  showStatus(
    "Preencha os dados, aceite o regulamento e conclua. Você será direcionado ao formulário oficial para anexar foto e áudio.",
    "info"
  );
})();