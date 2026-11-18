/* Only read the helper on the same SillyTavern origin. */
function tavernWorldHelper(){
 for(const host of [window,window.opener,window.parent]){
  if(!host)continue;
  try{
   if(host.location.origin!==window.location.origin)continue;
   const helper=host.TavernHelper;
   if(typeof helper?.getWorldbookNames==='function'&&typeof helper.getWorldbook==='function')return helper;
  }catch{ /* A standalone preview may have a cross-origin opener. */ }
 }
 return null;
}
function drawTavernBooks(){
 const helper=tavernWorldHelper();
 if(!helper){toast('请保持酒馆页面打开，并启用酒馆助手');return}
 const names=[...new Set(helper.getWorldbookNames())].sort((a,b)=>a.localeCompare(b,'zh'));
 const active=new Set(helper.getGlobalWorldbookNames?.()??[]);
 modal('从酒馆选世界书',`<label class="search">${icon('Search')}<input id="tavern-world-query" placeholder="搜索世界书" aria-label="搜索世界书"></label>
  ${typeof helper.getGlobalWorldbookNames==='function'?'<label class="row"><input type="checkbox" class="check" id="tavern-world-active">仅全局开启</label>':''}
  <div class="source-list" id="tavern-world-list"></div>`);
 const query=document.getElementById('tavern-world-query');
 const enabled=document.getElementById('tavern-world-active');
 const list=document.getElementById('tavern-world-list');
 const update=()=>{
  const q=query.value.trim().toLowerCase();
  list.innerHTML=names.filter(name=>(!enabled?.checked||active.has(name))&&name.toLowerCase().includes(q)).map(name=>
   `<button class="reference-option" type="button" data-tavern-world="${esc(name)}">${esc(name)}</button>`).join('')||'<p class="muted">没有匹配的世界书</p>';
 };
 query.addEventListener('input',update);
 enabled?.addEventListener('change',update);
 list.addEventListener('click',async event=>{
  const button=event.target.closest('[data-tavern-world]');
  if(!button||list.getAttribute('aria-busy')==='true')return;
  const name=button.dataset.tavernWorld;
  list.setAttribute('aria-busy','true');
  try{
   const entries=PresetDocument.helperWorldEntries(await helper.getWorldbook(name));
   if(list.isConnected&&document.getElementById('modal').open)openWorldSource(name,entries);
  }catch(error){if(list.isConnected)toast('无法读取世界书：'+error.message)}
  finally{list.removeAttribute('aria-busy')}
 });
 update();
}
document.addEventListener('click',event=>{
 if(!event.target.closest('[data-action="read-tavern-world"]'))return;
 try{drawTavernBooks()}catch(error){toast('无法读取世界书列表：'+error.message)}
});
window.addEventListener('focus',()=>{
 if(!entryId&&route==='work'&&!document.getElementById('modal').open){
  if(Boolean(document.querySelector('[data-action="read-tavern-world"]'))!==Boolean(tavernWorldHelper()))render();
 }
});
render();
