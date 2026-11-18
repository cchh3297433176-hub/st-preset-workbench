/* Interaction patterns informed by preset-stitcher-mobile and SillyTavern-PresetEditor.
   Independently implemented prototype, with browser-local demo data. */
state.refEntries=Array.isArray(state.refEntries)?state.refEntries:[];
let pendingEntry=null,activeSort=null,refDraft=null,refSource='wasteland',refQuery='',refExpanded=new Set();
const baseRender=render,baseChat=chat,baseWorkspace=workspace,baseDiff=diffCard,baseRequestDemo=requestDemo;
const uid=()=>typeof crypto.randomUUID==='function'?crypto.randomUUID():'local-'+Date.now()+'-'+Math.random().toString(36).slice(2);
const importedReferences=new Map();
const sourcePreset=pid=>importedReferences.get(pid)||presets.find(p=>p.id===pid);
const sourceEntries=pid=>importedReferences.get(pid)?.entries||(pid===state.target?state.entries:seeds.map(e=>({...clone(e),name:e.id==='view'?`世界观 · ${presets.find(p=>p.id===pid)?.name}`:e.name,content:e.id==='view'?`{{setvar::worldview::\n<worldview>\n背景：${presets.find(p=>p.id===pid)?.name}。\n规则：遵循该世界的社会秩序、资源条件与角色信息边界。\n</worldview>\n}}\n{{trim}}`:e.content})));
const refKey=(p,e)=>p+'::'+e;
const refCount=()=>state.refs.length+state.refEntries.length;
const refSummary=()=>[state.refs.length?`${state.refs.length} 份预设`:'',state.refEntries.length?`${state.refEntries.length} 个条目`:''].filter(Boolean).join(' · ')||'未选参考';
function referenceItems(){return [...state.refs.map(pid=>({key:'whole::'+pid,pid,name:sourcePreset(pid)?.name||pid,whole:true})),...state.refEntries.map(r=>({key:refKey(r.presetId,r.entryId),pid:r.presetId,eid:r.entryId,name:sourceEntries(r.presetId).find(e=>e.id===r.entryId)?.name||'条目已移除',whole:false}))]}
refStrip=function(){return `<div class="reference-strip">${referenceItems().map(r=>`<span class="reference-chip"><button data-action="inspect-reference" data-key="${esc(r.key)}">${r.whole?'':esc(sourcePreset(r.pid)?.name||'当前草稿')+' / '}${esc(r.name)}${r.whole?' · 整份':''}</button><button class="chip-remove" data-action="remove-reference" data-key="${esc(r.key)}" aria-label="移除参考 ${esc(r.name)}">${icon('X')}</button></span>`).join('')}<button class="add-reference" data-action="references" aria-label="添加参考条目">${icon('Plus')}添加参考</button></div>`};
chat=function(){return baseChat().replace(`参考 ${state.refs.length} 份预设`,refSummary())};
workspace=function(){return baseWorkspace().replace(`<span class="selection-count">${state.refs.length}</span>`,`<span class="selection-count">${refCount()}</span>`)};
function placeOptions(value,exclude=[]){return `<option value="keep" ${value==='keep'?'selected':''}>保持当前位置</option><option value="top" ${value==='top'?'selected':''}>列表开头</option><option value="bottom" ${value==='bottom'?'selected':''}>列表末尾</option>`+state.entries.filter(e=>!exclude.includes(e.id)).map((e,i)=>`<option value="before:${esc(e.id)}" ${value==='before:'+e.id?'selected':''}>${esc(e.name)} · 前面</option><option value="after:${esc(e.id)}" ${value==='after:'+e.id?'selected':''}>${esc(e.name)} · 后面</option>`).join('')}
function placementLabel(value){if(value==='top')return '列表开头';if(value==='bottom')return '列表末尾';if(value==='keep')return '保持当前位置';const [side,...parts]=value.split(':'),e=state.entries.find(e=>e.id===parts.join(':'));return e?`「${e.name}」${side==='after'?'后面':'前面'}`:'列表末尾'}
function placementBox(value='keep',exclude=[],id='edit-placement'){
 const split=value.indexOf(':'),anchor=split<0?'':value.slice(split+1);
 const number=state.entries.findIndex(entry=>entry.id===anchor)+1;
 const side=split<0?(state.insertSide||'after'):value.slice(0,split);
 const edge=number?'number':value;
 return `<section class="placement-box" data-placement-picker="${id}">
 <h3>放置位置</h3>
 <input type="hidden" id="${id}" value="${esc(value)}">
 <div class="placement-controls">
 <select data-placement-mode aria-label="位置类型">${[['number','按编号'],['top','列表开头'],['bottom','列表末尾'],...(id==='edit-placement'&&!pendingEntry?[['keep','保持当前位置']]:[])].map(([key,label])=>`<option value="${key}" ${edge===key?'selected':''}>${label}</option>`).join('')}</select>
 <input type="text" inputmode="numeric" pattern="[0-9]*" data-placement-number aria-label="目标条目编号" placeholder="编号" value="${number||''}">
 <select data-placement-side aria-label="插入方向" ${edge==='number'?'':'disabled'}><option value="before" ${side==='before'?'selected':''}>之前</option><option value="after" ${side==='after'?'selected':''}>之后</option></select>
 </div>
 <div class="placement-preview" id="${id}-preview" aria-live="polite">${esc(placementLabel(value))}</div>
 <details class="placement-browse" data-placement-browse><summary>查看编号与正文</summary>
 <input type="search" data-placement-search aria-label="搜索定位条目" placeholder="搜索编号、名称或正文">
 <div class="placement-list"></div></details>
 <script type="application/json" data-placement-excluded>${JSON.stringify(exclude).replaceAll('<','\\u003c')}</script>
 </section>`;
}
function placementExclusions(picker){
 return new Set(JSON.parse(picker.querySelector('[data-placement-excluded]').textContent));
}
function syncPlacement(picker){
 const mode=picker.querySelector('[data-placement-mode]').value;
 const number=picker.querySelector('[data-placement-number]'),side=picker.querySelector('[data-placement-side]');
 side.disabled=mode!=='number';
 const index=/^\d+$/.test(number.value.trim())?Number(number.value)-1:-1;
 const anchor=state.entries[index];
 const valid=anchor&&!placementExclusions(picker).has(anchor.id);
 const value=mode!=='number'?mode:valid?side.value+':'+anchor.id:'';
 picker.querySelector('input[type=hidden]').value=value;
 picker.querySelector('.placement-preview').textContent=mode==='number'
  ?valid?`插到 ${index+1}「${anchor.name}」${side.value==='before'?'之前':'之后'}`:'请选择有效的目标编号'
  :placementLabel(value);
}
function drawPlacementRows(picker,limit=40){
 const query=picker.querySelector('[data-placement-search]').value.trim().toLowerCase();
 const excluded=placementExclusions(picker);
 const matches=state.entries.map((entry,index)=>({entry,number:index+1})).filter(({entry,number})=>
  !excluded.has(entry.id)&&(!query||String(number)===query||entry.name.toLowerCase().includes(query)||entry.content.toLowerCase().includes(query)));
 picker.querySelector('.placement-list').innerHTML=matches.slice(0,limit).map(({entry,number})=>
  `<div class="placement-row"><button type="button" data-action="placement-anchor" data-index="${number}"><span>${number}</span><span>${esc(entry.name)}</span></button><details><summary aria-label="查看 ${esc(entry.name)} 正文">正文</summary><div class="source-body" data-placement-body="${number}"></div></details></div>`
 ).join('')+(matches.length>limit?`<button type="button" class="btn small" data-action="placement-more" data-index="${limit+40}">显示更多</button>`:'')+(matches.length?'':'<p class="muted">没有匹配条目</p>');
}
document.addEventListener('toggle',event=>{
 const el=event.target;
 if(el.matches?.('[data-placement-browse]')&&el.open&&!el.querySelector('.placement-list').hasChildNodes())drawPlacementRows(el.closest('[data-placement-picker]'));
 const body=el.open&&el.querySelector?.(':scope > [data-placement-body]');
 if(body)body.textContent=state.entries[Number(body.dataset.placementBody)-1]?.content||'无正文';
},true);
document.addEventListener('input',event=>{
 const input=event.target,picker=input.closest('[data-placement-picker]');
 if(!picker)return;
 if(input.matches('[data-placement-search]'))drawPlacementRows(picker);
 else {
  if(input.matches('[data-placement-number]'))picker.querySelector('[data-placement-mode]').value='number';
  syncPlacement(picker);
 }
});
document.addEventListener('change',event=>{
 const picker=event.target.closest('[data-placement-picker]');
 if(picker)syncPlacement(picker);
});
function moveEntries(ids,value){if(value==='keep')return;const items=state.entries.filter(e=>ids.includes(e.id)),rest=state.entries.filter(e=>!ids.includes(e.id));let at=rest.length;if(value==='top')at=0;else if(value!=='bottom'){const [side,...parts]=value.split(':'),target=rest.findIndex(e=>e.id===parts.join(':'));if(target>=0)at=target+(side==='after'?1:0)}rest.splice(at,0,...items);state.entries=rest}
function showMove(ids){selected=new Set(ids);modal('放置所选条目',`<p class="muted">${ids.length} 个条目，保留相对顺序。</p>${placementBox('bottom',ids,'move-placement')}`,'<button class="btn primary" data-action="confirm-move-v2">放到这里</button>')}
editList=function(){const list=state.entries.filter(e=>e.name.includes(search)||e.content.includes(search));return `<div class="editor-toolbar"><label class="search">${icon('Search')}<input id="entry-search" placeholder="搜索条目或内容" aria-label="搜索条目或内容" value="${esc(search)}"></label><button class="btn" data-action="references">${icon('Library')}来源</button><button class="btn ${bulk?'soft':''}" data-action="bulk">${bulk?'完成':'多选'}</button><button class="icon-button" data-action="add-entry" aria-label="新建条目">${icon('Plus')}</button></div>${bulk?`<div class="bulkbar"><span class="grow" id="selection-total">已选 ${selected.size} 项</span><button class="btn small" data-action="select-all">${list.every(e=>selected.has(e.id))&&list.length?'取消全选':'全选'}</button><button class="btn small" data-action="move" ${selected.size?'':'disabled'}>移动</button><button class="btn small" data-action="selected-ai" ${selected.size?'':'disabled'}>交给 AI</button><button class="btn small" data-action="selected-reference" ${selected.size?'':'disabled'}>作参考</button><button class="btn small" data-action="batch-toggle" ${selected.size?'':'disabled'}>启停</button></div>`:''}<div class="order-top"><span>草稿顺序 · ${state.entries.length} 个条目</span><span>${search?'搜索中，请清除搜索后拖动':'长按手柄拖动 · 更多操作在行尾'}</span></div><div class="order-list" id="order-list">${list.map(e=>{const idx=state.entries.findIndex(x=>x.id===e.id),changed=JSON.stringify(e)!==JSON.stringify(state.baseline.find(b=>b.id===e.id));return `<div class="order-row ${changed?'changed':''} ${e.enabled?'':'off'}" data-entry="${esc(e.id)}">${bulk?`<input class="check" type="checkbox" aria-label="选择 ${esc(e.name)}" data-select="${esc(e.id)}" ${selected.has(e.id)?'checked':''}>`:''}<button class="order-grip" data-action="grip-help" data-id="${esc(e.id)}" aria-label="移动 ${esc(e.name)}">${icon('GripVertical')}</button><button class="prompt-open" data-action="edit-entry" data-id="${esc(e.id)}"><span class="prompt-name"><span class="order-number">${String(idx+1).padStart(2,'0')}</span>${changed?'<i class="changed-dot"></i>':''}${esc(e.name)}</span><span class="prompt-note"><span class="role-dot">${(e.marker||['persona','char','world','history'].includes(e.id))?'Marker':esc(e.role)}</span><span>${e.position==='in_chat'?'@ 深度 '+e.depth:esc(e.group)}</span></span></button><button class="toggle ${e.enabled?'on':''}" role="switch" aria-checked="${e.enabled}" aria-label="启用 ${esc(e.name)}" data-action="toggle-entry" data-id="${esc(e.id)}"></button><button class="icon-button more" data-action="entry-menu" data-id="${esc(e.id)}" aria-label="更多操作 ${esc(e.name)}">${icon('MoreHorizontal')}</button></div>`}).join('')}</div>${!list.length?'<div class="empty">没有找到对应条目</div>':''}<div class="order-save"><button class="text-button" data-action="undo" ${history.length?'':'disabled'}>${icon('Undo2')}撤销</button><button class="btn soft" data-action="tab" data-value="ai">${icon('MessageSquare')}AI 修改</button><button class="btn primary" data-action="tab" data-value="review">审阅${dirty()?' '+dirty():''}</button></div>`};
entryEditor=function(){const e=pendingEntry||state.entries.find(x=>x.id===entryId);if(!e){entryId=null;return workspace()}return `<div class="row spread"><button class="text-button" data-action="back-editor">${icon('ArrowLeft')}返回条目</button><span class="muted">${pendingEntry?'新建条目':'编辑条目'}</span></div><input class="editor-title" id="edit-name" aria-label="条目名称" value="${esc(e.name)}">${placementBox(pendingEntry?.placement||'keep',[e.id])}<label class="field-label" for="edit-content">条目内容</label><textarea class="editor-text" id="edit-content" spellcheck="false">${esc(e.content)}</textarea><details class="settings-detail"><summary>发送设置</summary><div class="settings-body"><div class="fields"><label class="field"><span class="field-label">消息角色</span><select id="edit-role">${['system','user','assistant'].map(r=>`<option ${e.role===r?'selected':''}>${r}</option>`).join('')}</select></label><label class="field"><span class="field-label">注入方式</span><select id="edit-position"><option value="relative" ${e.position==='relative'?'selected':''}>按条目顺序</option><option value="in_chat" ${e.position==='in_chat'?'selected':''}>聊天内注入</option></select></label><label class="field"><span class="field-label">聊天深度</span><input id="edit-depth" type="number" min="0" max="999" value="${e.depth}"></label><label class="field"><span class="field-label">分类</span><select id="edit-group">${[...new Set([...state.entries.map(x=>x.group),e.group])].map(g=>`<option ${g===e.group?'selected':''}>${esc(g)}</option>`).join('')}</select></label></div></div></details><div class="sticky-actions"><button class="btn" data-action="reference-entry" data-id="${esc(e.id)}">${icon('MessageSquare')}交给 AI 修改</button><button class="btn primary" data-action="save-entry">保存到草稿</button></div>`};
function commitEditor(){const name=document.getElementById('edit-name')?.value.trim();if(!name){toast('请填写条目名称');return false}const e=pendingEntry||state.entries.find(x=>x.id===entryId);if(!e)return false;if(!document.getElementById('edit-placement').value){toast('请选择有效的目标编号');return false}checkpoint();e.name=name;e.content=document.getElementById('edit-content').value;e.role=document.getElementById('edit-role').value;e.position=document.getElementById('edit-position').value;e.depth=Math.max(0,Math.min(999,Number(document.getElementById('edit-depth').value)||0));e.group=document.getElementById('edit-group').value;const place=document.getElementById('edit-placement').value;if(pendingEntry){delete e.placement;state.entries.push(e)}moveEntries([e.id],place);pendingEntry=null;save();return true}
saveEditor=function(){if(commitEditor()){entryId=null;render();toast('已按所选位置保存到草稿')}};
references=function(){refDraft={whole:new Set(state.refs),entries:new Map(state.refEntries.map(r=>[refKey(r.presetId,r.entryId),clone(r)]))};refQuery='';drawReferences()};
function drawReferences(){const entries=sourceEntries(refSource),whole=refDraft.whole.has(refSource),list=entries.filter(e=>(e.name+' '+e.content).toLowerCase().includes(refQuery.toLowerCase()));const count=refDraft.whole.size+refDraft.entries.size;modal('选择参考',`<div class="source-picker"><select id="reference-source" aria-label="参考来源预设">${[...importedReferences.values(),...presets].map(p=>`<option value="${esc(p.id)}" ${refSource===p.id?'selected':''}>${esc(p.id===state.target?'当前草稿 · '+(state.targetName||p.name):p.name)}</option>`).join('')}</select><label class="reference-whole"><input class="check" type="checkbox" id="whole-reference" ${whole?'checked':''}>参考整份预设<span class="source-selected" style="margin-left:auto">${entries.length} 条</span></label><label class="search">${icon('Search')}<input id="ref-search" value="${esc(refQuery)}" placeholder="搜索此预设中的条目" aria-label="搜索参考条目"></label><div class="source-list">${list.map(e=>{const key=refKey(refSource,e.id),on=whole||refDraft.entries.has(key);return `<div class="source-row"><div class="source-row-head"><label><input type="checkbox" class="check" data-ref-entry="${esc(e.id)}" ${on?'checked':''} ${whole?'disabled':''}><span class="grow"><h3>${esc(e.name)}</h3><small>${esc(e.role)} · ${e.content.length} 字符</small></span></label><button class="icon-button" data-action="ref-preview" data-id="${esc(e.id)}" aria-label="预览 ${esc(e.name)}" aria-expanded="${refExpanded.has(key)}">${icon(refExpanded.has(key)?'ChevronUp':'ChevronDown')}</button></div>${refExpanded.has(key)?`<div class="source-body">${esc(e.content||'上下文占位条目')}</div>`:''}</div>`}).join('')||'<div class="empty">未找到条目</div>'}</div>${importedReferences.has(refSource)||refSource===state.target&&state.importedDocument?'':'<span class="source-selected">示例条目</span>'}</div>`,`<div class="ref-footer"><button class="btn" data-action="import-reference">导入参考</button><span id="ref-selection-count">已选 ${count} 项 · 可跨预设选择</span><button class="btn" data-action="stitch-reference" ${refDraft.entries.size?'':'disabled'}>缝入草稿</button><button class="btn primary" data-action="save-refs">使用所选参考</button></div>`)}
function inspectRef(key){const r=referenceItems().find(r=>r.key===key);if(!r)return;const p=sourcePreset(r.pid);if(r.whole){refSource=r.pid;references();return}const e=sourceEntries(r.pid).find(e=>e.id===r.eid);modal(e?.name||'参考条目',`<p class="muted">来源：${esc(p?.name)}</p><div class="source-body">${esc(e?.content||'条目不在当前草稿中')}</div>`,'<button class="btn" data-action="references">调整参考</button><button class="btn primary" data-action="close-modal">返回</button>')}
diffCard=function(p,i,selectable){let html=baseDiff(p,i,selectable);if(selectable&&!state.entries.some(e=>e.id===p.id)){p.placement=p.placement||'after:view';html=html.replace('</article>',`<div class="diff-placement"><label>放置位置<select data-plan-placement="${i}" aria-label="${esc(p.name)}的放置位置">${placeOptions(p.placement)}</select></label></div></article>`)}return html};
requestDemo=function(text){baseRequestDemo(text);state.plans.forEach(p=>{if(!state.entries.some(e=>e.id===p.id)&&!p.placement)p.placement='after:view'});const msg=state.messages.at(-1);if(msg?.role==='assistant'&&refCount())msg.content+='\n本次参考：'+referenceItems().map(r=>r.name+(r.whole?'（整份）':'（条目）')).join('、')+'。';save();render()};
render=function(){activeSort?.destroy();activeSort=null;baseRender();const el=document.getElementById('order-list');if(el&&!search&&typeof Sortable!=='undefined')activeSort=new Sortable(el,{handle:'.order-grip',draggable:'.order-row',animation:150,delay:220,delayOnTouchOnly:true,touchStartThreshold:5,forceFallback:true,fallbackOnBody:true,scroll:true,scrollSensitivity:65,scrollSpeed:10,ghostClass:'sort-ghost',chosenClass:'sort-chosen',onEnd(evt){if(evt.oldIndex===evt.newIndex)return;checkpoint();const ids=[...el.querySelectorAll('[data-entry]')].map(e=>e.dataset.entry),map=new Map(state.entries.map(e=>[e.id,e]));state.entries=ids.map(id=>map.get(id));save();const y=window.scrollY;render();window.scrollTo(0,y);toast('顺序已保留在草稿，尚未应用')}})};
function entryMenu(id){const e=state.entries.find(e=>e.id===id);if(!e)return;modal(e.name,`<div class="action-grid"><button class="btn" data-action="move-one" data-id="${esc(id)}">${icon('Move')}移动到…</button><button class="btn" data-action="duplicate-entry" data-id="${esc(id)}">${icon('FileText')}复制条目</button><button class="btn" data-action="new-at" data-id="${esc(id)}" data-side="before">${icon('Plus')}在前面新建</button><button class="btn" data-action="new-at" data-id="${esc(id)}" data-side="after">${icon('Plus')}在后面新建</button><button class="btn" data-action="reference-one" data-id="${esc(id)}">${icon('Link2')}作为参考</button><button class="btn danger" data-action="remove-entry" data-id="${esc(id)}">${icon('Trash2')}移出草稿</button></div>`)}
function startEntry(placement='bottom'){pendingEntry={id:uid(),name:'新条目',group:'写作约束',content:'',enabled:true,role:'system',depth:4,position:'relative',placement};entryId=pendingEntry.id;closeModal();route='work';tab='edit';render();window.scrollTo(0,0)}
function handleV2(b){const {action:a,id,key,side}=b.dataset;
if(a==='placement-anchor'||a==='placement-more'){
 const picker=b.closest('[data-placement-picker]');
 if(a==='placement-more'){drawPlacementRows(picker,Number(b.dataset.index));return true}
 picker.querySelector('[data-placement-mode]').value='number';
 picker.querySelector('[data-placement-number]').value=b.dataset.index;
 syncPlacement(picker);
 return true
}
if(a==='references'){references();return true}
if(a==='toggle-ref'){refSource=id;references();return true}
if(a==='open-preset'&&id!==state.target){refSource=id;references();return true}
if(a==='save-refs'){state.refs=[...refDraft.whole];state.refEntries=[...refDraft.entries.values()].filter(r=>!refDraft.whole.has(r.presetId));save();closeModal();render();toast('已更新参考：'+refSummary());return true}
if(a==='ref-preview'){const k=refKey(refSource,id);refExpanded.has(k)?refExpanded.delete(k):refExpanded.add(k);const y=document.querySelector('.modal-content').scrollTop;drawReferences();document.querySelector('.modal-content').scrollTop=y;return true}
if(a==='inspect-reference'){inspectRef(key);return true}
if(a==='remove-reference'){state.refs=state.refs.filter(pid=>'whole::'+pid!==key);state.refEntries=state.refEntries.filter(r=>refKey(r.presetId,r.entryId)!==key);save();render();return true}
if(a==='entry-menu'){entryMenu(id);return true}
if(a==='grip-help'){toast('长按拖动；也可点行尾菜单选择放置位置');return true}
if(a==='move-one'){showMove([id]);return true}
if(a==='move'){showMove([...selected]);return true}
if(a==='confirm-move-v2'){const v=document.getElementById('move-placement').value;if(!v){toast('请选择有效的目标编号');return true}checkpoint();moveEntries([...selected],v);save();closeModal();render();toast('已移动到'+placementLabel(v)+'，仅修改草稿');return true}
if(a==='select-all'){const list=state.entries.filter(e=>e.name.includes(search)||e.content.includes(search));const all=list.every(e=>selected.has(e.id));list.forEach(e=>all?selected.delete(e.id):selected.add(e.id));render();return true}
if(a==='reference-one'||a==='selected-reference'){const ids=a==='reference-one'?[id]:[...selected];ids.forEach(eid=>{if(!state.refs.includes(state.target)&&!state.refEntries.some(r=>r.presetId===state.target&&r.entryId===eid))state.refEntries.push({presetId:state.target,entryId:eid})});save();closeModal();toast(`已将 ${ids.length} 个条目加入参考`);return true}
if(a==='duplicate-entry'){checkpoint();const at=state.entries.findIndex(e=>e.id===id),x={...clone(state.entries[at]),id:uid(),name:state.entries[at].name+' · 副本'};state.entries.splice(at+1,0,x);save();closeModal();render();return true}
if(a==='remove-entry'){checkpoint();state.entries=state.entries.filter(e=>e.id!==id);state.refEntries=state.refEntries.filter(r=>!(r.presetId===state.target&&r.entryId===id));save();closeModal();render();toast('已移出草稿，可撤销');return true}
if(a==='new-at'){startEntry(side+':'+id);return true}
if(a==='add-entry'){startEntry();return true}
if(a==='back-editor'){const e=pendingEntry||state.entries.find(x=>x.id===entryId),changed=e&&(document.getElementById('edit-content').value!==e.content||document.getElementById('edit-name').value!==e.name||document.getElementById('edit-placement').value!==(pendingEntry?.placement||'keep')||document.getElementById('edit-role').value!==e.role||document.getElementById('edit-group').value!==(state.importedDocument?(e.groupId||''):e.group)||Number(document.getElementById('edit-depth').value)!==e.depth||document.getElementById('edit-position').value!==e.position);if(changed)modal('保留这次编辑？','<p class="muted">内容或位置尚未保存到草稿。</p>','<button class="btn" data-action="discard-editor">放弃修改</button><button class="btn primary" data-action="save-and-close-editor">保存到草稿</button>');else{pendingEntry=null;entryId=null;render()}return true}
if(a==='discard-editor'){pendingEntry=null;entryId=null;closeModal();render();return true}
if(a==='reference-entry'){const eid=entryId;if(!commitEditor())return true;entryId=null;tab='ai';render();document.getElementById('chat-input').value=`请修改“${state.entries.find(x=>x.id===eid)?.name}”：`;return true}
if(a==='apply-plans'){if(!planSelection.size)return true;checkpoint();state.plans.filter((p,i)=>planSelection.has(i)).forEach(p=>{const existing=state.entries.find(e=>e.id===p.id);if(existing){existing.name=p.name;existing.content=p.after}else{state.entries.push({id:p.id,name:p.name,content:p.after,group:p.group,enabled:true,role:'system',depth:4,position:'relative',...(state.importedDocument?{groupId:null}:{})});moveEntries([p.id],p.placement||'bottom')}});state.plans=state.plans.filter((p,i)=>!planSelection.has(i));planSelection=new Set(state.plans.map((_,i)=>i));save();render();toast('所选建议已按位置加入草稿');return true}
return false}
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b&&handleV2(b)){e.preventDefault();e.stopImmediatePropagation()}},true);
document.addEventListener('change',e=>{const t=e.target;if(t.id==='reference-source'){refSource=t.value;refQuery='';drawReferences();return}if(t.id==='whole-reference'){t.checked?refDraft.whole.add(refSource):refDraft.whole.delete(refSource);if(t.checked)for(const [key,r] of refDraft.entries)if(r.presetId===refSource)refDraft.entries.delete(key);drawReferences();return}if(t.dataset.refEntry){const id=t.dataset.refEntry,key=refKey(refSource,id);t.checked?refDraft.entries.set(key,{presetId:refSource,entryId:id}):refDraft.entries.delete(key);document.querySelector('[data-action=stitch-reference]').disabled=!refDraft.entries.size;document.getElementById('ref-selection-count').textContent=`已选 ${refDraft.whole.size+refDraft.entries.size} 项 · 可跨预设选择`;return}if(t.id==='edit-placement'||t.id==='move-placement'){document.getElementById(t.id+'-preview').textContent=placementLabel(t.value)}if(t.dataset.planPlacement!=null){state.plans[Number(t.dataset.planPlacement)].placement=t.value;save()}},true);
document.addEventListener('input',e=>{if(e.target.id==='ref-search'){const pos=e.target.selectionStart;refQuery=e.target.value;drawReferences();const next=document.getElementById('ref-search');next.focus();next.setSelectionRange(pos,pos)}},true);
render();
