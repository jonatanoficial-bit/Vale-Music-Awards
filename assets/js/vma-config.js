// assets/js/vma-config.js
window.VMA = {
  FESTIVAL_NAME: "Vale Music Awards",

  // Upload do navegador precisa ser Storage (Apps Script bloqueia por CORS no GitHub Pages)
  UPLOAD_PROVIDER: "firebase",

  LIMITS: {
    MAX_CANDIDATES: 100,
    MAX_AUDIO_MB: 6,
    MAX_AUDIO_SECONDS: 180,
    MAX_PHOTO_MB: 1.5,
  },

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