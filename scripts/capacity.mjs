#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {parseCsv,pick} from './lib/csv.mjs';
import {table as textTable} from './lib/format.mjs';
import {page,table,writeOut} from './lib/render.mjs';

export const specs={
 help:[],clusters:[],workloads:[], 'capacity-review':[], 'sizing-review':[], 'stale-data':[], 'change-review':[],compliance:[], 'actions-due':[], 'source-actions':[],activity:[],
 workload:['workload'],
 'add-cluster':['code','name','owner','cpu','memory','reserve','date','evidence','actor'],
 'review-cluster':['cluster','cpu','memory','reserve','date','evidence','actor'],
 'add-workload':['cluster','code','name','owner','cpu','memory','critical','actor'],
 'record-observation':['workload','date','days','cpu-p95','memory-p95','evidence','actor'],
 'propose-change':['workload','code','cpu','memory','due','reason','rollback','actor'],
 'decide-change':['change','decision','evidence','impact','actor'],
 'record-outcome':['change','outcome','evidence','actor'],
 'log-action':['code','name','owner','due','source','actor'],
 'close-action':['action','resolution','actor'],
 import:['file','map','dry-run','actor'],export:['out'],
 'weekly-review':[], 'draft-change':['change']
};
export const commands=Object.keys(specs);
const mutators=new Set(['add-cluster','review-cluster','add-workload','record-observation','propose-change','decide-change','record-outcome','log-action','close-action','import']);
export function parse(args){
 const command=args.shift()||'help';if(!specs[command])throw Error('Unknown command. Use help.');
 if(command==='import'&&args.shift()!=='ibm-turbonomic')throw Error('Use import ibm-turbonomic --file=export.csv');
 const opts={};for(const arg of args){const m=arg.match(/^--([a-z-]+)(?:=(.*))?$/s);if(!m)throw Error('Use --name=value flags');const [,k,v]=m;if(k in opts)throw Error(`Duplicate flag ${k}`);if(!['json',...specs[command]].includes(k))throw Error(`Unknown flag ${k}`);if(['json','dry-run','critical'].includes(k)){if(v!==undefined)throw Error(`${k} is a switch`);opts[k]=true;}else{if(v===undefined||!v.trim())throw Error(`${k} needs a value`);opts[k]=v;}}
 return {command,opts};
}
export function date(v){const s=String(v||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s)throw Error('Date must be a real YYYY-MM-DD');return s;}
const today=()=>new Date().toISOString().slice(0,10);
const past=v=>{v=date(v);if(v>today())throw Error('Evidence date cannot be in the future');return v;};
const req=(o,k)=>{if(typeof o[k]!=='string'||!o[k].trim())throw Error(`Required --${k}`);return o[k].trim();};
export function number(v,min=0,max=1000000,integer=false){if(!/^\d+(?:\.\d{1,3})?$/.test(String(v)))throw Error('Expected a non-negative decimal with at most three decimal places');const n=Number(v);if(n<min||n>max||(integer&&!Number.isInteger(n)))throw Error('Number outside allowed range');return n;}
const whole=(v,min=1,max=1000000)=>number(v,min,max,true);
async function find(db,t,value){
 if(!value)throw Error(`Choose a ${t} record`);
 const rows=await db.query(`SELECT * FROM ${t} ORDER BY code`);
 const exact=rows.filter(x=>x.id===value||x.code.toLowerCase()===value.toLowerCase());
 const matches=exact.length?exact:rows.filter(x=>x.id.startsWith(value.toLowerCase())||String(x.name||'').toLowerCase().includes(value.toLowerCase()));
 if(matches.length!==1)throw Error(matches.length?`Ambiguous ${t}: ${matches.map(x=>x.code+' '+(x.name||'')).join('; ')}`:`No matching ${t}`);return matches[0];
}
async function insert(db,t,data){const keys=Object.keys(data);return (await db.query(`INSERT INTO ${t} (${keys.join(',')}) VALUES (${keys.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING *`,Object.values(data)))[0];}
const digest=s=>createHash('sha256').update(s).digest('hex');
const readQueries={
 clusters:'SELECT code,name,owner,cpu_capacity,memory_gib,reserve_pct,reviewed_on FROM clusters ORDER BY code',
 workloads:'SELECT code,name,cluster_code,owner,cpu,memory_gib,critical FROM workload_review ORDER BY code',
 'capacity-review':'SELECT code,workloads,allocated_cpu,cpu_headroom,allocated_memory_gib,memory_headroom_gib,inventory_state FROM capacity_review ORDER BY code',
 'sizing-review':"SELECT code,cpu,suggested_cpu,memory_gib,suggested_memory_gib,critical,data_state FROM workload_review WHERE data_state='ready' AND (cpu<>suggested_cpu OR memory_gib<>suggested_memory_gib) ORDER BY code",
 'stale-data':"SELECT code,owner,observed_on,window_days,data_state FROM workload_review WHERE data_state<>'ready' ORDER BY code",
 'change-review':'SELECT code,workload_code,old_cpu,proposed_cpu,old_memory_gib,proposed_memory_gib,due_on,status,overdue FROM change_review ORDER BY due_on,code',
 compliance:'SELECT * FROM compliance_review ORDER BY rule,record',
 'actions-due':"SELECT code,name,owner,due_on FROM followups WHERE resolution IS NULL AND due_on<=current_date+7 ORDER BY due_on,code",
 'source-actions':'SELECT id,description,risk_type,execution,source_created,source_executed FROM source_actions ORDER BY created_at,id',
 activity:'SELECT command,actor,details,created_at FROM activity ORDER BY created_at,id'
};
export async function run(db,command,o={}){
 if(!specs[command])throw Error('Unknown command');
 if(readQueries[command])return db.query(readQueries[command]);
 if(command==='help')return Object.entries(specs).map(([command,flags])=>({command,flags:flags.map(x=>'--'+x).join(' ')}));
 if(command==='workload'){
  const w=await find(db,'workloads',req(o,'workload'));
  return {workload:w,observations:await db.query('SELECT * FROM observations WHERE workload_id=$1 ORDER BY observed_on DESC',[w.id]),changes:await db.query('SELECT * FROM change_review WHERE workload_id=$1 ORDER BY created_at',[w.id])};
 }
 if(command==='weekly-review'){
  const sections=[];for(const c of ['capacity-review','stale-data','change-review','actions-due'])sections.push({title:c,html:table(await run(db,c))});
  return {file:writeOut('drafts','weekly-review-'+randomUUID(),page({title:'Weekly capacity review',subtitle:'Synthetic data when demo seed is installed. Review evidence before acting.',sections}))};
 }
 if(command==='draft-change'){
  const ch=await find(db,'changes',req(o,'change'));
  return {file:writeOut('drafts','change-'+ch.id+'-'+randomUUID(),page({title:'Capacity change record',subtitle:'Review only. This document does not execute a change.',sections:[{title:'Proposal and decision',html:table(await db.query('SELECT * FROM change_review WHERE id=$1',[ch.id]))},{title:'Measurement evidence',html:table(await db.query('SELECT * FROM observations WHERE id=$1',[ch.observation_id]))}]}))};
 }
 if(command==='export'){
  const records={};await db.exec('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');try{
   for(const t of ['clusters','workloads','observations','changes','decisions','outcomes','imports','source_actions','followups','activity'])records[t]=await db.query(`SELECT * FROM ${t} ORDER BY id`);
   await db.exec('COMMIT');
  }catch(e){await db.exec('ROLLBACK');throw e;}
  const out=path.resolve(req(o,'out'));fs.writeFileSync(out,JSON.stringify({format:'capacity-planning-v1',exported_at:new Date().toISOString(),records},null,2)+'\n',{flag:'wx',mode:0o600});return {file:out,groups:Object.keys(records).length};
 }
 if(!mutators.has(command))throw Error('Unsupported command');
 const actor=req(o,'actor');await db.exec('BEGIN');
 try{
  // All CLI mutations take the same lock before reading state, including imports.
  await db.exec('LOCK TABLE clusters IN SHARE ROW EXCLUSIVE MODE');let result;
  if(command==='add-cluster')result=await insert(db,'clusters',{code:req(o,'code'),name:req(o,'name'),owner:req(o,'owner'),cpu_capacity:whole(req(o,'cpu')),memory_gib:whole(req(o,'memory')),reserve_pct:whole(o.reserve??'20',0,80),reviewed_on:past(req(o,'date')),evidence:req(o,'evidence')});
  if(command==='review-cluster'){
   const c=await find(db,'clusters',req(o,'cluster'));const reviewed=past(req(o,'date'));if(reviewed<c.reviewed_on)throw Error('Review date cannot go backwards');
   result=(await db.query('UPDATE clusters SET cpu_capacity=$1,memory_gib=$2,reserve_pct=$3,reviewed_on=$4,evidence=$5 WHERE id=$6 RETURNING *',[whole(req(o,'cpu')),whole(req(o,'memory')),whole(req(o,'reserve'),0,80),reviewed,req(o,'evidence'),c.id]))[0];
  }
  if(command==='add-workload'){
   const c=await find(db,'clusters',req(o,'cluster'));result=await insert(db,'workloads',{code:req(o,'code'),name:req(o,'name'),owner:req(o,'owner'),cluster_id:c.id,cpu:whole(req(o,'cpu'),1,100000),memory_gib:whole(req(o,'memory')),critical:Boolean(o.critical)});
  }
  if(command==='record-observation'){
   const w=await find(db,'workloads',req(o,'workload'));result=await insert(db,'observations',{workload_id:w.id,observed_on:past(req(o,'date')),window_days:whole(req(o,'days'),1,365),cpu_p95:number(req(o,'cpu-p95')),memory_p95_gib:number(req(o,'memory-p95')),evidence:req(o,'evidence'),actor});
  }
  if(command==='propose-change'){
   const w=await find(db,'workloads',req(o,'workload'));const r=(await db.query('SELECT * FROM workload_review WHERE id=$1',[w.id]))[0];if(r?.data_state!=='ready')throw Error('Fresh measurements over at least fourteen days required');
   const open=await db.query("SELECT id FROM change_review WHERE workload_id=$1 AND outcome IS NULL AND COALESCE(decision,'')<>'rejected'",[w.id]);if(open.length)throw Error('Workload already has an open change');
   const cpu=whole(req(o,'cpu'),1,100000),mem=whole(req(o,'memory'));
   if(cpu===w.cpu&&mem===w.memory_gib)throw Error('Proposed size is unchanged');
   if(cpu<r.suggested_cpu||mem<r.suggested_memory_gib)throw Error('Proposed size is below the measured-demand policy floor');
   result=await insert(db,'changes',{code:req(o,'code'),workload_id:w.id,observation_id:r.observation_id,old_cpu:w.cpu,old_memory_gib:w.memory_gib,proposed_cpu:cpu,proposed_memory_gib:mem,due_on:date(req(o,'due')),reason:req(o,'reason'),rollback_plan:req(o,'rollback'),actor});
  }
  if(command==='decide-change'){
   const ch=await find(db,'changes',req(o,'change')),decision=req(o,'decision');if(!['approved','rejected'].includes(decision))throw Error('Decision must be approved or rejected');
   if(decision==='approved'){
    if(ch.actor.toLowerCase()===actor.toLowerCase())throw Error('A different reviewer must approve the proposal');
    const w=(await db.query('SELECT * FROM workload_review WHERE id=$1',[ch.workload_id]))[0];
    if(w?.data_state!=='ready'||w.observation_id!==ch.observation_id||w.cpu!==ch.old_cpu||w.memory_gib!==ch.old_memory_gib)throw Error('Proposal evidence or allocation is stale; reject and propose again');
   }
   result=await insert(db,'decisions',{change_id:ch.id,decision,actor,evidence:req(o,'evidence'),impact_review:req(o,'impact')});
  }
  if(command==='record-outcome'){
   const ch=await find(db,'changes',req(o,'change'));const d=(await db.query('SELECT * FROM decisions WHERE change_id=$1',[ch.id]))[0];if(d?.decision!=='approved')throw Error('Approved decision required');
   const outcome=req(o,'outcome');if(!['verified','failed','cancelled'].includes(outcome))throw Error('Outcome must be verified, failed or cancelled');
   if(outcome==='verified'){
    const w=(await db.query('SELECT * FROM workloads WHERE id=$1',[ch.workload_id]))[0];if(w.cpu!==ch.old_cpu||w.memory_gib!==ch.old_memory_gib)throw Error('Allocation changed since proposal');
    await db.query('UPDATE workloads SET cpu=$1,memory_gib=$2 WHERE id=$3',[ch.proposed_cpu,ch.proposed_memory_gib,ch.workload_id]);
   }
   result=await insert(db,'outcomes',{change_id:ch.id,outcome,actor,evidence:req(o,'evidence')});
  }
  if(command==='log-action'){
   let source=null;if(o.source){const rows=await db.query('SELECT id FROM source_actions WHERE id::text LIKE $1',[req(o,'source')+'%']);if(rows.length!==1)throw Error('Choose one exact source action id');source=rows[0].id;}
   result=await insert(db,'followups',{code:req(o,'code'),name:req(o,'name'),owner:req(o,'owner'),due_on:date(req(o,'due')),source_action_id:source,actor});
  }
  if(command==='close-action'){
   const a=await find(db,'followups',req(o,'action'));if(a.resolution!==null)throw Error('Action already closed');result=(await db.query('UPDATE followups SET resolution=$1 WHERE id=$2 RETURNING *',[req(o,'resolution'),a.id]))[0];
  }
  if(command==='import')result=await importActions(db,o,actor);
  if(o['dry-run'])await db.exec('ROLLBACK');else{
   if(!result.already_imported)await insert(db,'activity',{command,actor,details:JSON.stringify(result)});
   await db.exec('COMMIT');
  }
  return result;
 }catch(e){await db.exec('ROLLBACK');throw e;}
}
async function importActions(db,o,actor){
 const file=path.resolve(req(o,'file')),original=fs.readFileSync(file,'utf8');
 const mapping=o.map?JSON.parse(fs.readFileSync(o.map,'utf8')):{};
 const defaults={description:'Action Description',risk:'Risk Type',execution:'Execution',created:'Date Created',executed:'Date Executed',id:'Action ID'};
 if(!mapping||Array.isArray(mapping)||typeof mapping!=='object')throw Error('Mapping must be an object');
 for(const [k,v] of Object.entries(mapping))if(!(k in defaults)||typeof v!=='string'||!v.trim())throw Error('Invalid mapping');
 const hash=digest(original+'\n'+JSON.stringify(mapping));
 if((await db.query('SELECT id FROM imports WHERE digest=$1',[hash])).length)return {inserted:0,already_imported:true};
 const rows=parseCsv(original);if(!rows.length)throw Error('CSV has no action rows');
 for(const v of Object.values(mapping))if(!Object.keys(rows[0]).some(k=>k.toLowerCase()===v.toLowerCase()))throw Error('Mapped column is missing: '+v);
 const get=(r,k)=>pick(r,mapping[k]||defaults[k]);
 const imp=await insert(db,'imports',{digest:hash,filename:path.basename(file),original_csv:original,mapping:JSON.stringify(mapping),actor});let count=0,duplicate=0;
 for(const r of rows){
  const description=get(r,'description').trim();if(!description)throw Error('Every row needs Action Description; map the actual header');
  const key=get(r,'id')?'id:'+get(r,'id'):'row:'+digest(JSON.stringify(Object.entries(r).sort(([a],[b])=>a.localeCompare(b))));
  const old=(await db.query('SELECT source_row FROM source_actions WHERE source_key=$1',[key]))[0];
  if(old){if(JSON.stringify(Object.entries(old.source_row).sort())!==JSON.stringify(Object.entries(r).sort()))throw Error('Conflicting source action id: '+key);duplicate++;continue;}
  await insert(db,'source_actions',{source_key:key,import_id:imp.id,description,risk_type:get(r,'risk'),execution:get(r,'execution'),source_created:get(r,'created'),source_executed:get(r,'executed'),source_row:JSON.stringify(r)});count++;
 }
 return {inserted:count,duplicate,import_id:imp.id,dry_run:Boolean(o['dry-run'])};
}
export function format(result){
 if(Array.isArray(result)){if(!result.length)return '(none)';return textTable(result,Object.keys(result[0]).map(key=>({key,label:key.replaceAll('_',' '),format:v=>typeof v==='object'&&v!==null?JSON.stringify(v):v,width:65})));}
 return JSON.stringify(result,null,2);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){let db;try{const {command,opts}=parse(process.argv.slice(2));db=await getDb();const result=await run(db,command,opts);console.log(opts.json?JSON.stringify(result):format(result));}catch(e){console.error(e.message);process.exitCode=1;}finally{if(db)await db.close();}}
