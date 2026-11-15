import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {getDb,REPO_ROOT} from './lib/db.mjs';import {migrate} from './migrate.mjs';import {seed} from './seed.mjs';
import {run,commands,parse,date,number} from './capacity.mjs';import {parseCsv} from './lib/csv.mjs';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'capacity-test-'));
process.env.DATA_DIR=path.join(temp,'db');process.env.OUTPUT_DIR=temp;process.env.DATABASE_URL=process.env.TEST_DATABASE_URL||'';
let db,n=0;const seen=new Set();const eq=(a,b)=>{assert.deepEqual(a,b);n++;};const ok=v=>{assert.ok(v);n++;};const reject=async(f,re)=>{await assert.rejects(f,re);n++;};
const day=(offset=0)=>new Date(Date.now()+offset*86400000).toISOString().slice(0,10);
const call=async(c,o={})=>{seen.add(c);return run(db,c,o);};
try{
 db=await getDb();if(process.env.TEST_DATABASE_URL){if((await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).length)throw Error('Use an empty disposable TEST_DATABASE_URL');}
 eq((await migrate(db)).ran.length,1);eq((await migrate(db)).ran.length,0);await seed(db);await seed(db);
 eq((await call('clusters')).length,2);eq((await call('workloads')).length,4);
 const capacity=await call('capacity-review');eq(capacity[0].cpu_headroom,-13);eq(capacity[0].memory_headroom_gib,-84);eq(capacity[1].inventory_state,'stale-inventory');
 const sizing=await call('sizing-review');eq(sizing.length,2);eq(sizing.find(x=>x.code==='WEB-01').suggested_cpu,6);eq(sizing.find(x=>x.code==='WEB-01').suggested_memory_gib,20);eq(sizing.find(x=>x.code==='BATCH-01').suggested_cpu,18);
 eq((await call('stale-data')).map(x=>x.data_state),['stale','missing']);eq((await call('change-review'))[0].overdue,true);eq((await call('actions-due')).length,2);
 const comp=await call('compliance');ok(comp.some(x=>x.rule==='CM-3-DECISION'));ok(comp.some(x=>x.rule==='LOCAL-INVENTORY'));eq((await call('activity')).length,0);eq((await call('source-actions')).length,0);eq((await call('help')).length,commands.length);
 eq((await call('workload',{workload:'web-01'})).observations.length,1);await reject(()=>call('workload',{workload:'reporting worker'}),/Ambiguous.*BATCH-01.*BATCH-02/);await reject(()=>call('workload',{workload:'missing'}),/No matching/);
 const cl=await call('add-cluster',{code:'TEST',name:'Test cluster',owner:'A',cpu:'32',memory:'128',reserve:'20',date:day(),evidence:'Inventory',actor:'A'});
 const w=await call('add-workload',{code:'TEST-VM',name:'<script>test</script>',cluster:cl.id,owner:'A',cpu:'8',memory:'32',critical:true,actor:'A'});
 await reject(()=>call('record-observation',{workload:w.id,date:day(1),days:'28','cpu-p95':'2.1','memory-p95':'7',evidence:'future',actor:'A'}),/future/);
 await call('record-observation',{workload:w.id,date:day(-1),days:'3','cpu-p95':'2.1','memory-p95':'7',evidence:'short',actor:'A'});ok((await call('stale-data')).some(x=>x.code==='TEST-VM'&&x.data_state==='short-window'));
 const prop={workload:w.id,code:'TEST-CHG',cpu:'3',memory:'10',due:day(2),reason:'Measured demand',rollback:'Restore original allocation',actor:'A'};
 await reject(()=>call('propose-change',prop),/Fresh measurements/);
 await call('record-observation',{workload:w.id,date:day(),days:'28','cpu-p95':'2.1','memory-p95':'7',evidence:'Full monitoring evidence',actor:'A'});
 await reject(()=>call('propose-change',{...prop,cpu:'2'}),/policy floor/);await reject(()=>call('propose-change',{...prop,cpu:'8',memory:'32'}),/unchanged/);
 const change=await call('propose-change',prop);await reject(()=>call('propose-change',{...prop,code:'SECOND'}),/open change/);
 await reject(()=>call('record-outcome',{change:change.id,outcome:'verified',evidence:'Test',actor:'A'}),/Approved/);
 await reject(()=>call('decide-change',{change:change.id,decision:'approved',evidence:'Checked',impact:'Impact tested',actor:'a'}),/different reviewer/);
 await call('decide-change',{change:change.id,decision:'approved',evidence:'Test log',impact:'Service and privacy impact checked',actor:'B'});
 ok((await call('compliance')).some(x=>x.record==='TEST-CHG'&&x.rule==='CM-3-VALIDATION'));
 await call('record-outcome',{change:change.id,outcome:'verified',evidence:'Measured healthy after change performed externally',actor:'B'});
 eq((await call('workload',{workload:w.id})).workload.cpu,3);eq((await call('workload',{workload:w.id})).workload.memory_gib,10);
 await reject(()=>call('record-outcome',{change:change.id,outcome:'verified',evidence:'Duplicate',actor:'B'}),/Allocation changed|unique|duplicate/);
 ok(!(await call('compliance')).some(x=>x.record==='TEST-CHG'));
 await call('review-cluster',{cluster:cl.id,cpu:'64',memory:'256',reserve:'25',date:day(),evidence:'New inventory',actor:'B'});eq((await call('capacity-review')).find(x=>x.code==='TEST').cpu_headroom,45);
 await reject(()=>call('review-cluster',{cluster:cl.id,cpu:'64',memory:'256',reserve:'25',date:day(-1),evidence:'old',actor:'B'}),/backwards/);
 const next=await call('propose-change',{...prop,code:'TEST-FAILED',cpu:'4',memory:'12'});await call('decide-change',{change:next.id,decision:'approved',evidence:'Test',impact:'Review',actor:'B'});await call('record-outcome',{change:next.id,outcome:'failed',evidence:'External operation failed',actor:'B'});eq((await call('workload',{workload:w.id})).workload.cpu,3);
 const cancel=await call('propose-change',{...prop,code:'TEST-CANCELLED',cpu:'4',memory:'12'});await call('decide-change',{change:cancel.id,decision:'approved',evidence:'Test',impact:'Review',actor:'B'});await call('record-outcome',{change:cancel.id,outcome:'cancelled',evidence:'Maintenance postponed',actor:'B'});eq((await call('workload',{workload:w.id})).workload.cpu,3);
 const rejected=await call('propose-change',{...prop,code:'TEST-REJECTED',cpu:'4',memory:'12'});await call('decide-change',{change:rejected.id,decision:'rejected',evidence:'Not needed',impact:'Reviewed',actor:'B'});await reject(()=>call('record-outcome',{change:rejected.id,outcome:'verified',evidence:'No',actor:'A'}),/Approved/);
 await reject(()=>call('decide-change',{change:'CHG-001',decision:'approved',evidence:'x',impact:'x',actor:'Demo'}),/different reviewer/);
 // A newer observation invalidates a previously proposed snapshot.
 const batch=await call('propose-change',{workload:'BATCH-01',code:'BATCH-CHANGE',cpu:'18',memory:'100',due:day(1),reason:'review',rollback:'restore',actor:'A'});
 await call('record-observation',{workload:'BATCH-01',date:day(),days:'28','cpu-p95':'13','memory-p95':'70',evidence:'new window',actor:'A'});
 await reject(()=>call('decide-change',{change:batch.id,decision:'approved',evidence:'x',impact:'x',actor:'B'}),/stale/);
 const input=fs.readFileSync(path.join(REPO_ROOT,'fixtures/turbonomic-actions.csv'),'utf8');const file=path.join(temp,'source.csv');fs.writeFileSync(file,input);
 eq((await call('import',{file,actor:'A','dry-run':true})).inserted,2);eq((await db.query('SELECT * FROM imports')).length,0);
 eq((await call('import',{file,actor:'A'})).inserted,2);eq((await call('import',{file,actor:'A'})).already_imported,true);eq((await db.query('SELECT original_csv FROM imports'))[0].original_csv,input);
 const sources=await call('source-actions');eq(sources.length,2);ok(sources.some(x=>x.execution==='Execution Failed'));eq((await db.query("SELECT source_row FROM source_actions WHERE source_key='id:DEMO-001'"))[0].source_row['Custom note'],'Synthetic fixture, preserve this');
 const action=await call('log-action',{code:'CHECK',name:'Review failed move',owner:'A',due:day(-1),source:sources[0].id,actor:'A'});await call('close-action',{action:action.id,resolution:'Reviewed original error',actor:'A'});await reject(()=>call('close-action',{action:action.id,resolution:'again',actor:'A'}),/already closed/);
 const bad=path.join(temp,'bad.csv');fs.writeFileSync(bad,input.replace('DEMO-001','NEW-001').replace('DEMO-002','NEW-002').replace('Move BATCH-02 to recovery host',''));
 await reject(()=>call('import',{file:bad,actor:'A'}),/Action Description/);eq((await db.query('SELECT * FROM source_actions')).length,2);eq((await db.query('SELECT * FROM imports')).length,1);
 fs.writeFileSync(bad,input.replace('from 16 to 6','from 16 to 8'));await reject(()=>call('import',{file:bad,actor:'A'}),/Conflicting/);
 fs.writeFileSync(bad,input.replaceAll('DEMO-','MAPPED-').replace('Action Description','Description'));const map=path.join(temp,'map.json');fs.writeFileSync(map,JSON.stringify({description:'Description'}));eq((await call('import',{file:bad,map,actor:'A'})).inserted,2);
 fs.writeFileSync(map,JSON.stringify({description:'Absent'}));await reject(()=>call('import',{file:bad,map,actor:'A'}),/missing/);
 fs.writeFileSync(map,JSON.stringify({bad:'Description'}));await reject(()=>call('import',{file:bad,map,actor:'A'}),/Invalid mapping/);
 for(const t of ['observations','changes','decisions','outcomes','imports','source_actions','activity'])await reject(()=>db.query(`DELETE FROM ${t}`),/append-only/);
 const out=path.join(temp,'snapshot.json');eq((await call('export',{out})).groups,10);const snapshot=JSON.parse(fs.readFileSync(out));eq(snapshot.records.imports.length,2);ok(snapshot.records.decisions.length>=4);await reject(()=>call('export',{out}),/EEXIST/);
 ok(fs.readFileSync((await call('weekly-review')).file,'utf8').includes('capacity-review'));const draft=fs.readFileSync((await call('draft-change',{change:change.id})).file,'utf8');ok(draft.includes('&lt;script&gt;'));ok(!draft.includes('<script>test'));
 for(const v of ['2026-02-30','2026-1-01','invalid']){assert.throws(()=>date(v));n++;}for(const v of ['-1','1e3','1,000','0.0001','Infinity','1000001']){assert.throws(()=>number(v));n++;}
 for(const args of [['help','extra'],['help','--json=false'],['workloads','--unknown'],['import','other'],['add-cluster','--actor=A','--actor=B']]){assert.throws(()=>parse(args));n++;}
 eq(parseCsv('\uFEFFA,B\r\n"a\nb","c""d"\r\n'),[{A:'a\nb',B:'c"d'}]);for(const s of ['A,a\n1,2','A,B\n1','A,B\n"bad,2']){assert.throws(()=>parseCsv(s));n++;}
 eq((await db.query("SELECT relname FROM pg_class WHERE relname IN ('clusters','workloads','observations','changes','decisions','outcomes','imports','source_actions','followups','activity') AND relrowsecurity")).length,10);
 eq(commands.filter(c=>!seen.has(c)),[]);await db.close();db=null;
 for(const script of ['view','docs']){const r=spawnSync(process.execPath,[`scripts/${script}.mjs`],{cwd:REPO_ROOT,env:process.env,encoding:'utf8'});if(r.status)console.error(r.stderr);eq(r.status,0);}
 const cli=spawnSync(process.execPath,['scripts/capacity.mjs','workloads','--json'],{cwd:REPO_ROOT,env:process.env,encoding:'utf8'});eq(cli.status,0);eq(JSON.parse(cli.stdout).length,5);
 const ambiguous=spawnSync(process.execPath,['scripts/capacity.mjs','workload','--workload=reporting worker'],{cwd:REPO_ROOT,env:process.env,encoding:'utf8'});eq(ambiguous.status,1);ok(ambiguous.stderr.includes('BATCH-02'));
 console.log(`PASS: ${n} assertions; ${seen.size} CLI commands; ${process.env.DATABASE_URL?'PostgreSQL':'PGlite'}; temporary database and output.`);
}catch(e){console.error(e.stack);process.exitCode=1;}finally{if(db)await db.close();fs.rmSync(temp,{recursive:true,force:true});}
