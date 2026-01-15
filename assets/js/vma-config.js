// assets/js/vma-config.js
export const VMA_CONFIG = {
  festivalName: "Vale Music Awards",

  // Sua URL do WebApp (a que você mandou)
  apiBaseUrl: "https://script.google.com/macros/s/AKfycbzhRsZy_tdu6xKX71sfrNOGFC8oEXyG4SpYi8xa5D5bj-q7ItVvRpvCrLrT0r11BoUh/exec",

  // Mesma SECRET do Code.gs
  secret: "VMA-2026-VALE-SEGREDO-9137",

  // Critérios (10 itens => 0..100)
  criteria: [
    { key: "afinacao", label: "Afinação" },
    { key: "ritmo", label: "Ritmo / Tempo" },
    { key: "interpretacao", label: "Interpretação" },
    { key: "dicao", label: "Pronúncia e Dicção" },
    { key: "timbre", label: "Timbre / Qualidade Vocal" },
    { key: "controle", label: "Controle Vocal (apoio/respiração)" },
    { key: "dinamica", label: "Dinâmica / Intensidade" },
    { key: "extensao", label: "Extensão / Alcance" },
    { key: "musicalidade", label: "Musicalidade" },
    { key: "potencial", label: "Potencial Artístico" }
  ],

  // Jurados (você pode editar depois)
  jurors: [
    { id: "J1", name: "Jurado 1", pin: "1111" },
    { id: "J2", name: "Jurado 2", pin: "2222" },
    { id: "J3", name: "Jurado 3", pin: "3333" },
    { id: "J4", name: "Jurado 4", pin: "4444" },
    { id: "J5", name: "Jurado 5", pin: "5555" }
  ]
};
