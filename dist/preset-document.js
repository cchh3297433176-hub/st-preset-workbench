/* Raw-preserving preset adapter. No imported JavaScript is evaluated. */
(function(root){
const copy=x=>JSON.parse(JSON.stringify(x));
function promptFields(p){
 return {id:p.identifier,name:typeof p.name==='string'&&p.name||p.identifier,
  content:typeof p.content==='string'?p.content:'',role:p.role||'system',
  depth:p.injection_depth??4,position:p.injection_position===1?'in_chat':'relative',
  marker:!!p.marker,injectionOrder:p.injection_order??100};
}
const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
function load(raw,groupIndex){
 if(!object(raw)||!Array.isArray(raw.prompts)||!Array.isArray(raw.prompt_order))throw Error('请选择包含 prompts 和 prompt_order 的完整酒馆预设 JSON');
 const ids=new Set();for(const p of raw.prompts){if(!object(p)||typeof p.identifier!=='string'||ids.has(p.identifier))throw Error('条目标识缺失或重复，暂不能安全编辑');ids.add(p.identifier)}
 if(groupIndex==null)groupIndex=Math.max(0,raw.prompt_order.findIndex(g=>g.character_id===100001));
 if(!Array.isArray(raw.prompt_order[groupIndex]?.order))throw Error('当前预设没有可读取的提示词顺序组');
 const order=raw.prompt_order[groupIndex].order,seen=new Set();
 for(const o of order){if(!object(o)||typeof o.identifier!=='string'||!ids.has(o.identifier)||seen.has(o.identifier))throw Error('顺序表存在重复或失效引用，暂不能安全编辑');seen.add(o.identifier)}
 const bg=raw.extensions?.baibaiToolkit?.presetPromptGroups;
 const supported=object(bg)&&bg.version===1&&Array.isArray(bg.groups)&&object(bg.prompts);
 const groups=supported?copy(bg.groups):[];
 const byId=new Map(raw.prompts.map(p=>[p.identifier,p]));
 const entry=(p,o)=>{const gid=supported?bg.prompts[p.identifier]?.groupId:null,g=groups.find(g=>g.id===gid);return {...promptFields(p),enabled:o?.enabled!==false,group:g?.name||'未分组',groupId:gid||null}};
 const entries=order.map(o=>entry(byId.get(o.identifier),o));
 return {raw:copy(raw),groupIndex,entries,baseline:copy(entries),groups,groupingSupported:supported,warnings:[...(bg&&!supported?['柏宝箱分组版本或结构暂不支持，原样保留，不转换']:[]),...(raw.extensions?.entryGrouping?['检测到其他分组格式，原样保留；本阶段不自动转换']:[])]};
}
function exportPreset(doc,entries=doc.entries){
 const raw=copy(doc.raw),old=new Map(doc.baseline.map(e=>[e.id,e])),byId=new Map(raw.prompts.map((p,i)=>[p.identifier,i])),order=raw.prompt_order[doc.groupIndex].order,orderById=new Map(order.map(o=>[o.identifier,o]));
 const outputIds=new Set();for(const e of entries){if(outputIds.has(e.id))throw Error('草稿存在重复条目标识');outputIds.add(e.id)}
 for(const e of entries){const b=old.get(e.id);let p;if(byId.has(e.id))p=raw.prompts[byId.get(e.id)];else{p={identifier:e.id,name:e.name,content:e.content,role:e.role,marker:!!e.marker,system_prompt:false,injection_position:e.position==='in_chat'?1:0,injection_depth:e.depth,injection_order:e.injectionOrder??100};byId.set(e.id,raw.prompts.length);raw.prompts.push(p)}
  for(const [ui,key] of [['name','name'],['content','content'],['role','role'],['depth','injection_depth']])if(!b||e[ui]!==b[ui])p[key]=e[ui];
  if(!b||e.position!==b.position)p.injection_position=e.position==='in_chat'?1:0;
  if(doc.groupingSupported&&(!b||e.groupId!==b.groupId)){const mapping=raw.extensions.baibaiToolkit.presetPromptGroups.prompts;if(e.groupId){if(!doc.groups.some(g=>g.id===e.groupId))throw Error('目标分组已失效');mapping[e.id]={...(mapping[e.id]||{}),groupId:e.groupId}}else if(mapping[e.id]){delete mapping[e.id].groupId;if(!Object.keys(mapping[e.id]).length)delete mapping[e.id]}}
 }
 raw.prompt_order[doc.groupIndex].order=entries.map(e=>{const b=old.get(e.id),o=copy(orderById.get(e.id)||{identifier:e.id,enabled:e.enabled});if(!b||e.enabled!==b.enabled)o.enabled=e.enabled;return o});
 // Prompts omitted from this order remain in the dictionary, preserving other character groups.
 return raw;
}
function scripts(raw){const out=[];function visit(nodes,path){if(!Array.isArray(nodes))return;nodes.forEach((n,i)=>{if(!object(n))return;const route=[...path,i];out.push({path:route,type:n.type||'unknown',id:n.id,name:n.name||'未命名',enabled:n.enabled,content:typeof n.content==='string'?n.content:'',depth:path.length});if(n.type==='folder')visit(n.scripts,route)})}visit(raw.extensions?.tavern_helper?.scripts,[]);return out}
function referenceEntries(doc){
 const ordered=new Set(doc.entries.map(e=>e.id));
 return [...doc.entries,...doc.raw.prompts.filter(p=>!ordered.has(p.identifier)).map(p=>({...promptFields(p),enabled:false}))];
}
function scriptAsset(raw,path){
 let nodes=raw.extensions?.tavern_helper?.scripts;
 let node;
 for(const index of path){node=nodes?.[index];nodes=node?.scripts}
 return node;
}
function attachScript(raw,asset){
 if(!object(asset)||asset.type!=='script'||typeof asset.id!=='string'||!asset.id||
    typeof asset.name!=='string'||typeof asset.content!=='string')throw Error('请选择酒馆助手导出的单个脚本 JSON');
 if(scripts(raw).some(s=>s.id===asset.id))throw Error('预设中已有相同 ID 的脚本');
 const next=copy(raw);
 next.extensions??={};
 next.extensions.tavern_helper??={};
 next.extensions.tavern_helper.scripts??=[];
 if(!Array.isArray(next.extensions.tavern_helper.scripts))throw Error('当前脚本树格式无法编辑');
 next.extensions.tavern_helper.scripts.push(copy(asset));
 return next;
}
function worldEntries(raw){
 const entries=raw?.entries;
 if(!object(entries)&&!Array.isArray(entries))throw Error('请选择 SillyTavern 世界书 JSON');
 const result=Object.entries(entries).filter(([,entry])=>object(entry)&&typeof entry.content==='string').map(([id,entry])=>{
  const keys=[entry.key,entry.keysecondary].flat().filter(key=>typeof key==='string'&&key);
  const inChat=entry.position===4;
  return {id,name:(typeof entry.comment==='string'&&entry.comment.trim())||keys[0]||`条目 ${id}`,content:entry.content,
   role:inChat?(['system','user','assistant'].includes(entry.role)?entry.role:['user','assistant'][Number(entry.role)-1]||'system'):'system',
   depth:inChat&&Number.isInteger(entry.depth)&&entry.depth>=0?entry.depth:4,
   position:inChat?'in_chat':'relative',enabled:entry.disable!==true,keys,constant:entry.constant===true};
 });
 if(!result.length)throw Error('世界书中没有可转换的条目');
 return result;
}
function helperWorldEntries(entries){
 if(!Array.isArray(entries))throw Error('酒馆助手返回了无法识别的条目');
 return worldEntries({entries:entries.map(entry=>({
  comment:entry?.name,content:entry?.content,disable:entry?.enabled===false,
  constant:entry?.strategy?.type==='constant',
  key:(entry?.strategy?.keys||[]).map(String),
  keysecondary:(entry?.strategy?.keys_secondary?.keys||[]).map(String),
  position:entry?.position?.type==='at_depth'?4:0,
  role:entry?.position?.role,depth:entry?.position?.depth
 }))});
}
const api={load,exportPreset,scripts,referenceEntries,scriptAsset,attachScript,worldEntries,helperWorldEntries};if(typeof module==='object'&&module.exports)module.exports=api;else root.PresetDocument=api;
})(globalThis);
