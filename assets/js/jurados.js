(async function(){const box=document.getElementById("judgeBox");if(!box)return;
const sess=vpReadJSON(VP_STORE_KEYS.judge,null);
function renderLogin(){box.innerHTML=`<b>Login</b><form id="lf" style="margin-top:12px;display:grid;gap:10px"><input name="user" placeholder="usuário" required style="padding:12px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.30);color:var(--text)"/><input name="pass" type="password" placeholder="senha" required style="padding:12px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.30);color:var(--text)"/><button class="btn btn--gold btn--block" type="submit">Entrar</button><div style="color:var(--muted2);font-size:12px">Credenciais em assets/js/config.js</div></form>`;
document.getElementById("lf").addEventListener("submit",(e)=>{e.preventDefault();const fd=new FormData(e.target);const u=String(fd.get("user")||"").trim();const p=String(fd.get("pass")||"").trim();
const ok=window.VP_CONFIG.judges.some(j=>j.user===u&&j.pass===p);if(!ok)return alert("Credenciais inválidas");
vpWriteJSON(VP_STORE_KEYS.judge,{user:u,at:new Date().toISOString()});renderPanel(u);});}
async function renderPanel(user){const cands=await vpLoadCandidates();box.innerHTML=`<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><b>Painel</b><div style="color:var(--muted);margin-top:4px">Salva notas no navegador (demo).</div></div><button class="btn btn--ghost" id="out">Sair</button></div>
<div style="margin-top:12px;display:grid;gap:10px">
<select id="sel" style="padding:12px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.30);color:var(--text)">${cands.map(c=>`<option value="${c.id}">${c.id} • ${c.nomeArtistico||c.nome}</option>`).join("")}</select>
<label style="color:var(--muted2);font-size:12px">Voz</label><input id="v" type="range" min="0" max="10" step="0.5" value="8"/>
<label style="color:var(--muted2);font-size:12px">Afinação</label><input id="a" type="range" min="0" max="10" step="0.5" value="8"/>
<label style="color:var(--muted2);font-size:12px">Interpretação</label><input id="i" type="range" min="0" max="10" step="0.5" value="8"/>
<textarea id="n" rows="3" placeholder="Observação (opcional)" style="padding:12px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.30);color:var(--text)"></textarea>
<button class="btn btn--gold" id="save">Salvar avaliação</button>
<div id="msg" style="color:var(--muted)"></div></div>`;
document.getElementById("out").onclick=()=>{localStorage.removeItem(VP_STORE_KEYS.judge);renderLogin();};
document.getElementById("save").onclick=()=>{const id=document.getElementById("sel").value;vpUpsertScore(id,user,{voz:Number(document.getElementById("v").value),afinacao:Number(document.getElementById("a").value),interpretacao:Number(document.getElementById("i").value),note:String(document.getElementById("n").value||"").trim()});
const agg=vpAggregate(id);document.getElementById("msg").innerHTML=`Salvo! Média: <b>${agg.weighted.toFixed(2)}</b> (${agg.judgesCount} jurado(s))`;};}
if(sess?.user) renderPanel(sess.user); else renderLogin();})();