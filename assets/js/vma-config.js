// assets/js/vma-config.js
// Config central do Vale Music Awards (Site + Apps Script + Forms)

export const VMA_CONFIG = {
  // Nome do evento
  FESTIVAL_NAME: "Vale Music Awards",

  // WebApp do Apps Script (SEU LINK CORRETO)
  APPS_SCRIPT_URL:
    "https://script.google.com/macros/s/AKfycbxRvwp0aOtgENIj6Hm0H_zb0IsDBzW-QM6BB7_eNKDzp5tSFVMgucItzidnKofVfKHw/exec",

  // Secret usado no Apps Script (rate) — mantenha igual ao do Code.gs
  SECRET: "VMA-2026-VALE-SEGREDO-9137",

  // Seu Google Forms oficial (para inscrição e upload de arquivos)
  FORMS_URL: "https://forms.gle/mTMT3nM4sHpU88mg7",

  // Limites técnicos (apenas para validação/UX no site — o upload real é no Forms)
  LIMITS: {
    PHOTO_MAX_MB: 1.5,
    AUDIO_MAX_MB: 10,     // MP3 3 min normalmente 3–6MB (10MB é confortável)
    AUDIO_MAX_MIN: 3
  },

  // Critérios (10 critérios => soma 0..100)
  CRITERIA: [
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
  ],

  // Logo (caminho RELATIVO correto no site)
  // (não use link do GitHub blob; use o caminho do site)
  LOGO_PATH: "../assets/img/vale-producao-logo.png"
};