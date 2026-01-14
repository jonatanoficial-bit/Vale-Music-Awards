// Firebase (CDN modular) – inicialização do app
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyCVRe7edXYJsQO7JTNA5ALyKBuEX9FjYGw",
  authDomain: "vale-music-awards.firebaseapp.com",
  projectId: "vale-music-awards",
  storageBucket: "vale-music-awards.firebasestorage.app",
  messagingSenderId: "554190941319",
  appId: "1:554190941319:web:886febb88ebc381d439c22",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
