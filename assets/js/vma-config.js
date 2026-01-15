// assets/js/vma-config.js
// Config central do Vale Music Awards (Site + Apps Script + Auth)

window.VMA_CONFIG = {
  FESTIVAL_NAME: "Vale Music Awards",

  // ✅ Seu Web App do Apps Script (Google Sheets/Forms API)
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxRvwp0aOtgENIj6Hm0H_zb0IsDBzW-QM6BB7_eNKDzp5tSFVMgucItzidnKofVfKHw/exec",

  // ✅ Seu Google Forms (inscrição oficial com upload)
  FORMS_URL: "https://forms.gle/mTMT3nM4sHpU88mg7",

  // ✅ Chave simples para evitar envio fake de notas (igual ao seu Code.gs)
  SECRET: "VMA-2026-VALE-SEGREDO-9137",

  // Critérios (10 itens -> soma 0..100)
  CRITERIA: [
    { key: "afinacao", label: "Afinação", hint: "Precisão das notas, estabilidade e controle." },
    { key: "ritmo", label: "Ritmo & Tempo", hint: "Pulsação, entradas/saídas e regularidade." },
    { key: "interpretacao", label: "Interpretação", hint: "Expressão, intenção e emoção musical." },
    { key: "dicao", label: "Pronúncia & Dicção", hint: "Clareza, articulação e inteligibilidade." },
    { key: "timbre", label: "Timbre", hint: "Qualidade vocal, cor e identidade." },
    { key: "controle", label: "Controle Vocal", hint: "Apoio, respiração e estabilidade técnica." },
    { key: "dinamica", label: "Dinâmica", hint: "Variações de intensidade, nuance e musicalidade." },
    { key: "extensao", label: "Extensão", hint: "Alcance confortável + transições de registro." },
    { key: "musicalidade", label: "Musicalidade", hint: "Fraseado, intenção rítmica e coerência." },
    { key: "potencial", label: "Potencial Artístico", hint: "Presença, originalidade e projeção de carreira." }
  ],

  // Limites exibidos ao candidato (no Forms você já controla upload)
  LIMITS: {
    PHOTO_MAX_MB: 1.5,
    AUDIO_MAX_MINUTES: 3
  },

  // Jurados confirmados
  JURY: {
    COUNT: 5,
    TITLE: "5 jurados profissionais da música"
  }
};
