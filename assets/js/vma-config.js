// Config do Vale Music Awards (sem mexer no resto)
window.VMA = {
  FESTIVAL_NAME: "Vale Music Awards",

  // Apps Script Web App URL (Drive uploader)
  DRIVE_ENDPOINT: "COLE_AQUI_A_URL_DO_WEB_APP",

  // Segredo do Apps Script (o mesmo que você colocou no Code.gs)
  DRIVE_SECRET: "TROQUE_POR_UM_SEGREDO_FORTE",

  // Limites
  LIMITS: {
    MAX_CANDIDATES: 100,
    MAX_AUDIO_MB: 6,
    MAX_AUDIO_SECONDS: 180,
    MAX_PHOTO_MB: 1.5
  },

  // Critérios (10 x 10 = 100)
  CRITERIA: [
    { key: "afinacao", label: "Afinação" },
    { key: "ritmo", label: "Ritmo / Tempo" },
    { key: "interpretacao", label: "Interpretação / Emoção" },
    { key: "dicao", label: "Pronúncia e Dicção" },
    { key: "timbre", label: "Timbre / Identidade vocal" },
    { key: "controle", label: "Controle / Respiração" },
    { key: "dinamica", label: "Dinâmica (variação)" },
    { key: "extensao", label: "Extensão / Alcance vocal" },
    { key: "musicalidade", label: "Musicalidade" },
    { key: "potencial", label: "Potencial artístico / mercado" },
  ],
};
