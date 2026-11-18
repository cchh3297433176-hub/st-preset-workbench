/* Phase 1: local JSON import/export, grouping membership, read-only script assets. */
let importedDoc=state.importedDocument||null,assetTab='groups';
const phaseRender=render,phaseEditor=entryEditor,phaseCommit=commitEditor,phaseRequest=requestDemo;
const fileInput=document.createElement('input');fileInput.type='file';fileInput.accept='.json,application/json';fileInput.hidden=true;document.body.append(fileInput);
function currentDoc(){if(!importedDoc)return null;return {...importedDoc,entries:state.entries}}
function localDownload(raw,name){const blob=new Blob([JSON.stringify(raw,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function groupIdForName(name){return importedDoc?.groups.find(g=>g.name===name)?.id||null}
function persistImported(){state.importedDocument=importedDoc;save()}
function adoptImport(raw,name,index){const doc=PresetDocument.load(raw,index);checkpoint();importedDoc=doc;state.entries=clone(doc.entries);state.baseline=clone(doc.entries);state.targetName=name.replace(/\.json$/i,'');state.refs=state.refs.filter(id=>importedReferences.has(id));state.refEntries=state.refEntries.filter(ref=>importedReferences.has(ref.presetId));state.messages=[];state.plans=[];planSelection.clear();pendingEntry=null;entryId=null;bulk=false;selected.clear();persistImported();closeModal();tab='edit';nav('work');toast(`已读取 ${doc.entries.length} 个条目；原文件未修改`)}
fileInput.addEventListener('change',async()=>{const file=fileInput.files[0];if(!file)return;try{if(file.size>25*1024*1024)throw Error('当前预览支持 25 MB 以内的预设');const raw=JSON.parse(await file.text());PresetDocument.load(raw);modal('导入到独立草稿',`<p class="muted">${esc(file.name)}</p><p class="muted" style="margin-top:12px">导入后切换编辑目标。当前草稿可用撤销恢复；原文件不会被修改。</p>`,'<button class="btn" data-action="close-modal">取消</button><button class="btn primary" data-action="confirm-import-document">载入草稿</button>');fileInput._pending={raw,name:file.name}}catch(e){toast('无法导入：'+e.message)}fileInput.value=''});
const referenceInput=fileInput.cloneNode();referenceInput.multiple=true;document.body.append(referenceInput);
const scriptInput=fileInput.cloneNode();document.body.append(scriptInput);
async function readAsset(file){
 if(file.size>25*1024*1024)throw Error('请选择 25 MB 以内的 JSON');
 return JSON.parse(await file.text());
}
const referenceDB=new Promise((resolve,reject)=>{
 const request=indexedDB.open('preset-workbench-references',1);
 request.onupgradeneeded=()=>request.result.createObjectStore('references',{keyPath:'id'});
 request.onsuccess=()=>resolve(request.result);
 request.onerror=()=>reject(request.error);
});
function referenceStorage(mode,operation){
 return referenceDB.then(db=>new Promise((resolve,reject)=>{
  const tx=db.transaction('references',mode);
  const request=operation(tx.objectStore('references'));
  tx.oncomplete=()=>resolve(request.result);
  tx.onabort=()=>reject(tx.error);
 }));
}
function registerReference(record){
 importedReferences.set(record.id,{id:record.id,name:record.name,entries:PresetDocument.referenceEntries(PresetDocument.load(record.raw))});
}
const referencesReady=referenceStorage('readonly',store=>store.getAll()).then(records=>{
 records.forEach(registerReference);
 if(document.getElementById('reference-source'))drawReferences();
 else if(!document.getElementById('modal').open&&!entryId)render();
}).catch(()=>{});
referenceInput.addEventListener('change',async()=>{
 const files=[...referenceInput.files];referenceInput.value='';
 await referencesReady;
 const errors=[];let active;
 for(const file of files){
  try{
   const raw=await readAsset(file);
   PresetDocument.load(raw);
   const record={id:uid(),name:file.name.replace(/\.json$/i,''),raw};
   await referenceStorage('readwrite',store=>store.put(record));
   registerReference(record);
   active=record.id;
  }catch(error){errors.push(file.name+'：'+error.message)}
 }
 if(active&&document.getElementById('reference-source')){refSource=active;refQuery='';drawReferences()}
 if(errors.length)toast('部分文件无法导入：'+errors.join('；'));
 else if(active)toast(`已导入 ${files.length} 份参考预设`);
});
scriptInput.addEventListener('change',async()=>{
 const file=scriptInput.files[0];scriptInput.value='';
 if(!file||!importedDoc)return;
 const target=importedDoc;
 try{
  const asset=await readAsset(file);
  if(importedDoc!==target)throw Error('草稿已切换，请重新选择脚本');
  const raw=PresetDocument.attachScript(target.raw,asset);
  checkpoint();
  importedDoc={...target,raw};
  persistImported();assetTab='scripts';assetPanel();toast('脚本已加入草稿');
 }catch(error){toast('无法导入脚本：'+error.message)}
});
function groupRows(groups){
 const buckets=new Map(groups.map(group=>[group.id,[]]));
 const ungrouped=[];
 for(const entry of state.entries)(buckets.get(entry.groupId)||ungrouped).push(entry);
 const ordered=[...groups].sort((a,b)=>(a.order??0)-(b.order??0));
 if(ungrouped.length)ordered.push({id:null,name:'未分组',collapsed:true});
 return ordered.map(group=>{
  const members=buckets.get(group.id)||ungrouped;
  return `<details class="settings-detail" ${group.collapsed?'':'open'}><summary>${esc(group.name)} · ${members.length}${group.enabled===false?' · 已停用':''}</summary><div class="settings-body">${members.map(entry=>`<button class="reference-option" style="width:100%;text-align:left" data-action="open-group-entry" data-id="${esc(entry.id)}">${esc(entry.name)}${entry.enabled?'':' · 已停用'}</button>`).join('')||'<span class="muted">此组没有当前条目</span>'}</div></details>`;
 }).join('');
}
render=function(){importedDoc=state.importedDocument||null;phaseRender();if(route==='work'&&!entryId){const heading=document.querySelector('.workspace-heading');if(heading){const bar=document.createElement('div');bar.className='row';bar.style.cssText='margin:0 0 16px;flex-wrap:wrap';bar.innerHTML=`${typeof tavernPresetManager==='function'&&tavernPresetManager()?'<button class="btn small" data-action="read-tavern-preset">从酒馆选预设</button>':''}<button class="btn small" data-action="preset-assets">${icon('FolderOpen')}分组与脚本</button><button class="btn small" data-action="import-world">${icon('BookOpen')}世界书转条目</button>${typeof tavernWorldHelper==='function'&&tavernWorldHelper()?'<button class="btn small" data-action="read-tavern-world">从酒馆选世界书</button>':''}${importedDoc?'<button class="btn small" data-action="export-imported">'+icon('Download')+'导出 JSON</button><span class="muted" style="font-size:10px">已载入 · '+state.entries.length+' 条</span>':''}`;heading.after(bar)}}};
entryEditor=function(){let html=phaseEditor();if(importedDoc){html=html.replace('<span class="field-label">分类</span>','<span class="field-label">柏宝箱分组</span>');const e=pendingEntry||state.entries.find(e=>e.id===entryId);const options=`<option value="" ${!e?.groupId?'selected':''}>未分组</option>`+importedDoc.groups.map(g=>`<option value="${esc(g.id)}" ${e?.groupId===g.id?'selected':''}>${esc(g.name)}</option>`).join('');html=html.replace(/<select id="edit-group">.*?<\/select>/,`<select id="edit-group" ${importedDoc.groupingSupported?'':'disabled'}>${options}</select>`);html=html.replace('<details class="settings-detail">',`<div class="notice" style="margin:12px 0">${icon('FolderOpen')}<span>分组归属与顺序独立保存；拖动不会自动改组。</span></div><details class="settings-detail">`)}return html};
commitEditor=function(){const e=pendingEntry||state.entries.find(e=>e.id===entryId),gid=document.getElementById('edit-group')?.value;if(importedDoc&&e){const menu=document.getElementById('edit-group');const original=phaseCommit;const success=original();if(success){const groupId=menu?.disabled?e.groupId:gid||null;e.groupId=groupId;e.group=importedDoc.groups.find(g=>g.id===groupId)?.name||'未分组';persistImported()}return success}return phaseCommit()};
requestDemo=function(text){if(importedDoc){toast('真实预设暂支持手动编辑；AI 仍为示例，尚未连接');return}phaseRequest(text)};
function assetPanel(){const raw=importedDoc?.raw,groups=importedDoc?.groups||[],scripts=raw?PresetDocument.scripts(raw):[];let body=`<div class="segmented"><button data-action="asset-tab" data-value="groups" class="${assetTab==='groups'?'active':''}">分组 ${groups.length}</button><button data-action="asset-tab" data-value="scripts" class="${assetTab==='scripts'?'active':''}">脚本 ${scripts.filter(s=>s.type==='script').length}</button></div>`;
 if(!raw)body+='<p class="muted">先导入一份完整预设，即可读取柏宝箱分组和酒馆助手脚本。脚本生成将在后续阶段接入。</p>';
 else if(assetTab==='groups'){body+=`<p class="muted" style="margin-bottom:12px">${importedDoc.groupingSupported?'柏宝箱分组 v1 · 原始 ID、顺序、启停、折叠状态均保留':'未检测到支持编辑的柏宝箱分组，其他扩展原样保留'}</p>`+groupRows(groups);body+=`<p class="muted" style="margin-top:13px">当前顺序组：${esc(raw.prompt_order[importedDoc.groupIndex].character_id)}；其余 ${raw.prompt_order.length-1} 个顺序组保留。</p>`;body+=importedDoc.warnings.map(w=>`<p class="muted">${esc(w)}</p>`).join('')}
 else{body+='<p class="muted" style="margin-bottom:12px">只读取代码，不加载或执行。脚本随预设导出，可在酒馆助手中使用。</p>';body+=scripts.map((s,i)=>`<button class="reference-option" style="width:100%;text-align:left;padding-left:${12+s.depth*15}px" data-action="inspect-script" data-index="${i}"><span class="reference-icon">${icon(s.type==='folder'?'FolderOpen':'FileText')}</span><span class="grow"><h3>${esc(s.name)}</h3><p>${s.type==='folder'?'文件夹':s.content.length+' 字符'} · ${s.enabled===false?'已停用':'已启用'}</p></span>${s.type==='script'?icon('ChevronRight'):''}</button>`).join('');if(!scripts.length)body+='<p class="muted">没有酒馆助手脚本。</p>'}
 modal('分组与脚本',body,`<button class="btn" data-action="import-document">导入预设</button>${raw&&assetTab==='scripts'?'<button class="btn" data-action="import-script">添加脚本</button>':''}${raw?'<button class="btn primary" data-action="export-imported">导出 JSON</button>':''}`)}
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b)return;const {action:a,value:v,index}=b.dataset;let handled=true;
 if(a==='import'||a==='import-document'){fileInput.click()}
 else if(a==='confirm-import-document'){try{adoptImport(fileInput._pending.raw,fileInput._pending.name);fileInput._pending=null}catch(err){toast(err.message)}}
 else if(a==='import-reference')referenceInput.click();
 else if(a==='import-script')scriptInput.click();
 else if(a==='open-group-entry'){closeModal();route='work';tab='edit';entryId=b.dataset.id;render();window.scrollTo(0,0)}
 else if(a==='download-script'){
  const script=PresetDocument.scripts(importedDoc.raw)[Number(index)];
  if(script?.type==='script')localDownload(PresetDocument.scriptAsset(importedDoc.raw,script.path),script.name+'.json');
 }
 else if(a==='preset-assets')assetPanel();
 else if(a==='asset-tab'){assetTab=v;assetPanel()}
 else if(a==='inspect-script'){const s=PresetDocument.scripts(importedDoc.raw)[Number(index)];if(s?.type==='script')modal(s.name,`<p class="muted">代码只读 · 未执行</p><textarea readonly aria-label="脚本源代码" style="width:100%;min-height:320px;font-family:monospace;font-size:12px;margin-top:12px" spellcheck="false">${esc(s.content)}</textarea>`,`<button class="btn" data-action="preset-assets">返回脚本树</button><button class="btn primary" data-action="download-script" data-index="${Number(index)}">导出脚本</button>`)}
 else if(a==='export-imported'){try{const doc=currentDoc();if(!doc)throw Error('请先导入预设');localDownload(PresetDocument.exportPreset(doc,state.entries),(state.targetName||'preset')+'-草稿.json');toast('已导出新文件，原文件未修改')}catch(err){toast('导出失败：'+err.message)}}
 else if(a==='save-version'&&importedDoc){const doc=PresetDocument.load(PresetDocument.exportPreset(currentDoc(),state.entries),importedDoc.groupIndex);importedDoc=doc;state.baseline=clone(state.entries);persistImported();render();toast('已保存本地草稿；导出后再导入酒馆')}
 else if(a==='undo'){handled=false;queueMicrotask(()=>{importedDoc=state.importedDocument||null;render()})}
 else if(a==='new'&&importedDoc){toast('当前在编辑导入文件；先导出保存，或使用设置重置后体验示例');}
 else handled=false;
 if(handled){e.preventDefault();e.stopImmediatePropagation()}
},true);
render();
