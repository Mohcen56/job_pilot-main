const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {Pool}=require('pg');
const {createLoader}=require('../load-ts.cjs');
require('@next/env').loadEnvConfig(process.cwd(),true);

test('real database imports preserve pending jobs, merge direct metadata, isolate cache ownership and filter published dates',async()=>{
  const pool=new Pool({connectionString:process.env.DATABASE_URL});const owners=[randomUUID(),randomUUID()];
  const load=createLoader({'@jobhunt/api/database/pool':{getPool:()=>pool}});
  try {
    for(const id of owners){await pool.query('INSERT INTO users(id,email) VALUES($1,$2)',[id,`discovery-${id}@example.test`]);await pool.query('INSERT INTO profiles(id) VALUES($1)',[id]);}
    const ctx=id=>({user:{id},database:new (load('@jobhunt/api/database/database').ScopedDatabase)(id)});
    const context=ctx(owners[0]);const foreign=ctx(owners[1]);
    const run=(await pool.query("INSERT INTO agent_runs(user_id,status) VALUES($1,'running') RETURNING id",[owners[0]])).rows[0].id;
    const {normalize}=load('@jobhunt/api/jobs/providers/common');
    const source={provider:'adzuna',companyIdentifier:'example',careerUrl:'https://example.com/careers',discoveryMethod:'adzuna'};
    const aggregated=normalize({source,signal:AbortSignal.timeout(5000),titles:['Developer']},{id:'agg1',title:'Junior Developer',company:'Example',location:'Istanbul',description:'Node.js',url:'https://adzuna.com/jobs/1'});
    const {saveDiscoveredJobs}=load('@jobhunt/api/jobs/persistence');
    const initial=await saveDiscoveredJobs(context,[aggregated,{...aggregated,title:''}],run);
    assert.equal(initial.inserted,1);assert.equal(initial.jobs[0].match_score,null);assert.equal(initial.jobs[0].published_at,null);assert.equal(initial.jobs[0].match_status,'pending');
    const id=initial.jobs[0].id;await pool.query("UPDATE jobs SET cover_letter='preserve',is_tailored=true,company_research=$2::jsonb WHERE id=$1",[id,JSON.stringify({companyOverview:'preserve'})]);
    const direct={...aggregated,externalId:'ats1',source:'greenhouse',sourceUrl:'https://boards.greenhouse.io/example/jobs/1',applyUrl:'https://boards.greenhouse.io/example/jobs/1',discoveryMethod:'ats_direct',publishedAt:new Date().toISOString()};
    const results=await Promise.all([saveDiscoveredJobs(context,[direct],run),saveDiscoveredJobs(context,[direct],run)]);
    assert.equal(results[0].inserted+results[1].inserted,0);
    const rows=(await pool.query('SELECT * FROM jobs WHERE user_id=$1',[owners[0]])).rows;
    assert.equal(rows.length,1);assert.equal(rows[0].source_provider,'greenhouse');assert.equal(rows[0].cover_letter,'preserve');assert.equal(rows[0].company_research.companyOverview,'preserve');assert.equal(rows[0].id,id);assert.equal(rows[0].is_tailored,true);
    await saveDiscoveredJobs(context,[aggregated],run);assert.equal((await pool.query('SELECT source_provider FROM jobs WHERE id=$1',[id])).rows[0].source_provider,'greenhouse');
    const {CareerSourceCache}=load('@jobhunt/api/jobs/source-cache');const cache=new CareerSourceCache(context);await cache.load();const ats={...source,provider:'greenhouse',careerUrl:'https://boards.greenhouse.io/example',discoveryMethod:'ats_direct'};await cache.save(ats,[direct],'query');
    const reloaded=new CareerSourceCache(context);assert.equal((await reloaded.load()).length,1);assert.equal(reloaded.read(ats,'query').length,1);
    assert.equal((await new CareerSourceCache(foreign).load()).length,0);
    const foreignUpdate=await foreign.database.from('career_sources').update({company_identifier:'foreign'}).eq('career_url',ats.careerUrl);assert.equal(foreignUpdate.data.length,0);
    const get=load('@jobhunt/api/jobs/list').GET;
    const dated=await (await get(new Request('http://localhost/api/jobs?freshnessDays=1'),context)).json();assert.equal(dated.data.jobs.length,1);
    await pool.query('UPDATE jobs SET published_at=NULL WHERE id=$1',[id]);
    const unknown=await (await get(new Request('http://localhost/api/jobs?freshnessDays=1'),context)).json();assert.equal(unknown.data.jobs.length,0);
    const isolated=await (await get(new Request('http://localhost/api/jobs'),foreign)).json();assert.equal(isolated.data.jobs.length,0);
    const {withDiscoveryLimit,DiscoveryLimitError}=load('@jobhunt/api/jobs/admission');
    await withDiscoveryLimit(context,async()=>{await assert.rejects(withDiscoveryLimit(context,async()=>{}),DiscoveryLimitError);});
    assert.equal((await pool.query('SELECT * FROM discovery_leases WHERE user_id=$1',[owners[0]])).rowCount,0);
  } finally {await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[owners]);await pool.end();}
});
