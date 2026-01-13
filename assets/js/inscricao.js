function fileToDataUrl(f){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result));r.onerror=rej;r.readAsDataURL(f);});}
(function(){const form=document.getElementById("registerForm");if(!form)return;const photo=document.getElementById("photoInput");const audio=document.getElementById("audioInput");
form.addEventListener("submit",async(e)=>{e.preventDefault();const fd=new FormData(form);
const obj={id:vpNextCandidateCode(),nome:String(fd.get("nome")||"").trim(),nomeArtistico:String(fd.get("nomeArtistico")||"").trim(),cidade:String(fd.get("cidade")||"").trim(),genero:String(fd.get("genero")||"").trim(),bio:String(fd.get("bio")||"").trim(),contato:{whats:String(fd.get("whats")||"").trim(),email:String(fd.get("email")||"").trim()},inscritoEm:new Date().toISOString().slice(0,10),foto:"../assets/img/vale-producao-logo.png",audio:""};
if(photo.files?.[0]) obj.foto=await fileToDataUrl(photo.files[0]);
if(audio.files?.[0]) obj.audio=await fileToDataUrl(audio.files[0]);
const regs=vpReadJSON(VP_STORE_KEYS.reg,[]);regs.push(obj);vpWriteJSON(VP_STORE_KEYS.reg,regs);vpWriteJSON(VP_STORE_KEYS.candSession,{code:obj.id,at:new Date().toISOString()});
alert(`Inscrição concluída! Seu código: ${obj.id}`);location.href="./candidato.html";});})();