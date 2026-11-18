/* Only read the helper on the same SillyTavern origin. */
function sameOriginTavernHosts(){
 return [window,window.opener,window.parent].filter(host=>{
  try{return host&&host.location.origin===window.location.origin}
  catch{return false}
 });
}
function tavernWorldHelper(){
 for(const host of sameOriginTavernHosts()){
  const helper=host.TavernHelper;
  if(typeof helper?.getWorldbookNames==='function'&&typeof helper.getWorldbook==='function')return helper;
 }
 return null;
}
function tavernPresetManager(){
 for(const host of sameOriginTavernHosts()){
  const manager=host.SillyTavern?.getContext?.()?.getPresetManager?.('openai');
  if(typeof manager?.getAllPresets==='function'&&typeof manager.getCompletionPresetByName==='function')return manager;
 }
 return null;
}
function drawTavernPresets(){
 const manager=tavernPresetManager();
 if(!manager){toast('请从酒馆左下角菜单重新打开工作台');return}
 const current=manager.getSelectedPresetName?.();
 const names=[...new Set(manager.getAllPresets())].filter(Boolean);
 names.sort((a,b)=>Number(b===current)-Number(a===current)||a.localeCompare(b,'zh'));
 modal('从酒馆选预设',`<label class="search">${icon('Search')}<input id="tavern-preset-query" placeholder="搜索预设" aria-label="搜索酒馆预设"></label><div class="source-list" id="tavern-preset-list"></div>`);
 const query=document.getElementById('tavern-preset-query');
 const list=document.getElementById('tavern-preset-list');
 const update=()=>{
  const q=query.value.trim().toLowerCase();
  list.innerHTML=names.filter(name=>name.toLowerCase().includes(q)).map(name=>
   `<button class="reference-option" type="button" data-tavern-preset="${esc(name)}">${esc(name)}${name===current?' · 当前':''}</button>`).join('')||'<p class="muted">没有匹配的聊天补全预设</p>';
 };
 list.addEventListener('click',event=>{
  const name=event.target.closest('[data-tavern-preset]')?.dataset.tavernPreset;
  if(!name)return;
  try{
   const raw=manager.getCompletionPresetByName(name);
   PresetDocument.load(raw);
   modal('载入酒馆预设',`<p>${esc(name)}</p><p class="muted">载入后切换当前草稿，可用撤销恢复。</p>`,
    '<button class="btn" data-action="close-modal">取消</button><button class="btn primary" id="confirm-tavern-preset">载入草稿</button>');
   document.getElementById('confirm-tavern-preset').addEventListener('click',()=>{
    try{adoptImport(raw,name)}catch(error){toast('无法载入预设：'+error.message)}
   },{once:true});
  }catch(error){toast('无法读取预设：'+error.message)}
 });
 query.addEventListener('input',update);
 update();
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
 if(event.target.closest('[data-action="read-tavern-preset"]')){
  try{drawTavernPresets()}catch(error){toast('无法读取预设列表：'+error.message)}
  return;
 }
 if(!event.target.closest('[data-action="read-tavern-world"]'))return;
 try{drawTavernBooks()}catch(error){toast('无法读取世界书列表：'+error.message)}
});
window.addEventListener('focus',()=>{
 if(!entryId&&route==='work'&&!document.getElementById('modal').open){
  if(Boolean(document.querySelector('[data-action="read-tavern-world"]'))!==Boolean(tavernWorldHelper())||Boolean(document.querySelector('[data-action="read-tavern-preset"]'))!==Boolean(tavernPresetManager()))render();
 }
});
render();
