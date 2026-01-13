(async function(){
  const stat = document.getElementById("statCandidates");
  if(stat){
    const cands = await vpLoadCandidates();
    stat.textContent = String(cands.length);
  }
})();
