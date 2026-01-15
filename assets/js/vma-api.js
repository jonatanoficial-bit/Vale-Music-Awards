// assets/js/vma-api.js
import { VMA_CONFIG } from "./vma-config.js";

function toQuery(params) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    q.set(k, String(v));
  });
  return q.toString();
}

async function getJson(params) {
  const url = `${VMA_CONFIG.apiBaseUrl}?${toQuery(params)}`;
  const res = await fetch(url, { method: "GET", cache: "no-store" });
  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error("Resposta inválida da API (não é JSON).");
  }
  if (!data.ok) {
    throw new Error(data.error || "Erro na API.");
  }
  return data;
}

export const VMA_API = {
  async candidates() {
    return getJson({ action: "candidates" });
  },

  async ranking() {
    return getJson({ action: "ranking" });
  },

  async rate({ jurorId, candidateId, scores }) {
    // scores é array de 10 numeros 0..10
    const scoresStr = scores.join(",");
    return getJson({
      action: "rate",
      secret: VMA_CONFIG.secret,
      jurorId,
      candidateId,
      scores: scoresStr
    });
  }
};
