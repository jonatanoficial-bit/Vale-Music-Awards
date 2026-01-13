/**
 * CONFIG - ajuste aqui sem mexer no resto do site.
 * (Em GitHub Pages é tudo front-end. Na fase 2 vamos ligar em um backend.)
 */
window.VP_CONFIG = {
  festival: {
    nome: "Vale Music Awards",
    subtitulo: "Festival Internacional de Talentos",
    organizacao: "Vale Produções",
    ano: new Date().getFullYear(),
    foco: "Vocal (Instrumental em breve)"
  },

  // Pesos do ranking
  weights: {
    voz: 0.40,
    afinacao: 0.35,
    interpretacao: 0.25,
  },

  // Credenciais demo (mude depois)
  judges: [
    { user: "jurado1", pass: "vale2026" },
    { user: "jurado2", pass: "vale2026" },
  ],

  // Prefixo do código do candidato e contador inicial (para inscrições demo)
  candidateCode: {
    prefix: "VMA",
    startAt: 2000,
  }
};
