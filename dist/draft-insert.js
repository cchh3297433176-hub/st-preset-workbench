/* Shared draft insertion for preset entries and SillyTavern world books. */
let insertBatch=null, worldSource=null, worldSelected=new Set(), worldRole='', aiTargets=[];
const worldInput=document.createElement('input');
worldInput.type='file';
worldInput.accept='.json,application/json';
worldInput.hidden=true;
document.body.append(worldInput);

function worldRows(){
 const query=document.getElementById('world-search').value.trim().toLowerCase();
 const entries=worldSource.entries.filter(entry=>[entry.name,entry.content,...entry.keys].some(text=>text.toLowerCase().includes(query)));
 const list=document.getElementById('world-list');
 list.innerHTML=entries.map(entry=>`<div class="source-row"><label class="row"><input type="checkbox" class="check" data-world-id="${esc(entry.id)}" ${worldSelected.has(entry.id)?'checked':''}>${esc(entry.name)}</label>
  <details><summary>正文${entry.keys.length?'与触发词':''}</summary><div data-world-body="${esc(entry.id)}"></div></details></div>`).join('')||'<div class="empty">没有匹配条目</div>';
}
function drawWorld(){
 modal(worldSource.name,`<label class="search">${icon('Search')}<input id="world-search" placeholder="搜索名称、正文或触发词" aria-label="搜索世界书条目"></label>
  <label class="row world-role">消息角色 <select id="world-role" aria-label="转换后的消息角色"><option value="">沿用可对应的角色</option><option>system</option><option>user</option><option>assistant</option></select></label>
  <div id="world-list" class="source-list"></div>`,
  `<button class="btn" data-action="import-world">换世界书</button><button class="btn primary" data-action="place-world" ${worldSelected.size?'':'disabled'}>转换 ${worldSelected.size} 条</button>`);
 document.getElementById('world-role').value=worldRole;
 worldRows();
}
function openWorldSource(name,entries){
 worldSource={name,entries};
 worldSelected=new Set();
 worldRole='';
 drawWorld();
}
worldInput.addEventListener('change',async()=>{
 const file=worldInput.files[0];
 worldInput.value='';
 if(!file)return;
 try{
  const entries=PresetDocument.worldEntries(await readAsset(file));
  openWorldSource(file.name.replace(/\.json$/i,''),entries);
 }catch(error){toast('无法读取世界书：'+error.message)}
});

function showBatch(entries,kind,skipped=0){
 if(!entries.length){toast('请选择至少一个有正文的条目');return}
 insertBatch={entries,kind,target:state.entries};
 const world=kind==='world';
 modal(world?'世界书转预设':'缝入草稿',
  `${world?'<p class="muted">触发词、概率等世界书条件不会迁移。启用的条目会按预设设置发送。</p>':'<p class="muted">复制所选条目。依赖的脚本、变量与正则需要单独核对。</p>'}
  ${skipped?`<p class="muted">已跳过 ${skipped} 个占位或无正文条目。</p>`:''}
  <div class="source-list insert-preview">${entries.map((entry,index)=>`<details><summary>${esc(entry.name)} · ${esc(entry.role)}${entry.position==='in_chat'?' · 深度 '+entry.depth:''}${entry.enabled?'':' · 停用'}</summary><div class="source-body" data-batch-body="${index}"></div></details>`).join('')}</div>
  ${placementBox('bottom',[],'batch-placement')}`,
  `<button class="btn" data-action="back-insert">返回选择</button><button class="btn primary" data-action="confirm-insert">加入草稿 · ${entries.length} 条</button>`);
}
function stitchSelected(){
 const rows=new Map();
 for(const {presetId,entryId} of refDraft.entries.values()){
  if(!rows.has(presetId))rows.set(presetId,new Set());
  rows.get(presetId).add(entryId);
 }
 const entries=[...rows].flatMap(([id,ids])=>sourceEntries(id).filter(entry=>ids.has(entry.id)&&!entry.marker&&entry.content.trim()));
 showBatch(entries,'stitch',refDraft.entries.size-entries.length);
}
function confirmInsert(){
 const placement=document.getElementById('batch-placement').value;
 if(!placement){toast('请选择有效的目标编号');return}
 if(insertBatch.target!==state.entries){closeModal();toast('草稿已变化，请重新选择位置');return}
 const group=state.importedDocument?'未分组':'新增条目';
 const added=insertBatch.entries.map(entry=>({
  id:uid(),name:entry.name,content:entry.content,role:entry.role,depth:entry.depth,
  position:entry.position,enabled:entry.enabled!==false,group,groupId:null,injectionOrder:entry.injectionOrder
 }));
 checkpoint();
 state.entries.push(...added);
 moveEntries(added.map(entry=>entry.id),placement);
 selected=new Set(added.map(entry=>entry.id));
 bulk=true;
 save();
 closeModal();
 tab='edit';
 nav('work');
 toast(`已加入并选中 ${added.length} 条`);
}
const sendChat=requestDemo;
requestDemo=function(text){
 if(aiTargets.some(id=>state.entries.some(entry=>entry.id===id))){
  toast('已选定要改的条目，真实 AI 接口尚未连接');
  return;
 }
 sendChat(text);
};
const renderChat=chat;
chat=function(){
 const ids=new Set(aiTargets);
 const names=state.entries.filter(entry=>ids.has(entry.id)).map(entry=>entry.name);
 return renderChat().replace('<div class="chat-wrap">',`<div class="chat-wrap">${names.length?`<div class="notice">已选 ${names.length} 条 · ${esc(names.join('、'))}<button class="text-button" data-action="clear-ai-targets">清除选择</button></div>`:''}`);
};
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-action]');
 if(!button)return;
 switch(button.dataset.action){
 case 'import-world': worldInput.click(); break;
 case 'edit-entry': aiTargets=[];return;
 case 'clear-ai-targets': {
  const draft=document.getElementById('chat-input')?.value;
  aiTargets=[];render();
  if(draft!=null)document.getElementById('chat-input').value=draft;
  break;
 }
 case 'stitch-reference': stitchSelected(); break;
 case 'place-world': showBatch(worldSource.entries.filter(entry=>worldSelected.has(entry.id)).map(entry=>({...entry,role:worldRole||entry.role})),'world'); break;
 case 'back-insert': if(insertBatch.kind==='world')drawWorld();else drawReferences(); break;
 case 'confirm-insert': confirmInsert(); break;
 case 'selected-ai': {
  aiTargets=state.entries.filter(entry=>selected.has(entry.id)).map(entry=>entry.id);
  if(!aiTargets.length)break;
  tab='ai';
  render();
  const input=document.getElementById('chat-input');
  input.value='请修改已选条目：';
  input.focus();
  break;
 }
 default: return;
 }
 event.preventDefault();
 event.stopImmediatePropagation();
},true);
document.addEventListener('change',event=>{
 const input=event.target;
 if(input.id==='world-role')worldRole=input.value;
 if(input.dataset.worldId!=null){
  input.checked?worldSelected.add(input.dataset.worldId):worldSelected.delete(input.dataset.worldId);
  const button=document.querySelector('[data-action=place-world]');
  button.disabled=!worldSelected.size;
  button.textContent=`转换 ${worldSelected.size} 条`;
 }
 if(input.id==='default-insert-side'){state.insertSide=input.value;save()}
});
document.addEventListener('input',event=>{if(event.target.id==='world-search')worldRows()});
document.addEventListener('toggle',event=>{
 const detail=event.target;
 if(!detail.open)return;
 const body=detail.querySelector?.(':scope > [data-world-body], :scope > [data-batch-body]');
 if(!body||body.hasChildNodes())return;
 if(body.dataset.worldBody!=null){
  const entry=worldSource.entries.find(entry=>entry.id===body.dataset.worldBody);
  const text=document.createElement('div');
  text.className='source-body';
  text.textContent=entry.content;
  body.append(text);
  if(entry.keys.length||entry.constant){
   const conditions=document.createElement('p');
   conditions.className='muted';
   conditions.textContent=entry.constant?'常驻':`触发词 · ${entry.keys.join('、')}`;
   body.prepend(conditions);
  }
 }else body.textContent=insertBatch.entries[Number(body.dataset.batchBody)].content;
},true);
