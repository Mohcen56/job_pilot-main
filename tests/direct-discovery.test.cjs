const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createLoader}=require('./load-ts.cjs');
const load=createLoader();
const {normalize}=load('@jobhunt/api/jobs/providers/common');
const norm=load('@jobhunt/api/jobs/normalization');
const input={source:{provider:'greenhouse',companyIdentifier:'example',careerUrl:'https://boards.greenhouse.io/example',discoveryMethod:'ats_direct'},signal:AbortSignal.timeout(30000),titles:['Backend Developer']};
const job=(overrides={})=>({...normalize(input,{id:'1',title:'Junior Backend Developer',company:'Example',description:'TypeScript, 1 to 2 years experience',location:'Istanbul, Turkey',url:'https://boards.greenhouse.io/example/jobs/1'}),...overrides});

test('ATS detection supports global/EU hosts, rejects disguised hosts and unsafe URLs',()=>{
  const {detectProvider}=load('@jobhunt/api/jobs/providers/detector');
  for(const [url,provider,id] of [['https://boards.greenhouse.io/example/jobs/1','greenhouse','example'],['https://job-boards.greenhouse.io/example','greenhouse','example'],['https://jobs.eu.lever.co/example/a','lever','example'],['https://jobs.ashbyhq.com/example/a','ashby','example'],['https://careers.smartrecruiters.com/Example','smartrecruiters','Example'],['https://apply.workable.com/example/','workable','example']]) {const actual=detectProvider(url);assert.equal(actual.provider,provider);assert.equal(actual.companyIdentifier,id);}
  assert.equal(detectProvider('https://boards.greenhouse.io.evil.example/example').provider,'company');
  for(const url of ['http://127.0.0.1/jobs','http://169.254.169.254/','https://user:pass@example.com/jobs','file:///jobs']) assert.equal(detectProvider(url),null);
});
test('normalization requires title/company/valid job links and preserves unknown publication dates',()=>{
  for(const missing of [{title:''},{company:''},{url:'javascript:alert(1)'}])assert.equal(normalize(input,{id:'1',title:'Developer',company:'Example',url:'https://example.com/jobs/1',...missing}),null);
  assert.equal(job().publishedAt,null);assert.equal(norm.publicationDate('bad'),null);
  assert.equal(norm.plainText('&lt;p&gt;Node.js&lt;/p&gt;'),'Node.js');
});
test('deduplication chooses employer source, canonicalizes tracking and preserves different locations',()=>{
  const direct=job();const aggregate={...direct,externalId:'agg1',source:'adzuna',applyUrl:'https://adzuna.com/jobs/agg1'};
  const result=norm.deduplicateJobs([aggregate,direct,{...direct,externalId:'2',applyUrl:'https://example.com/jobs/2',location:'London'}]);assert.equal(result.length,2);assert.equal(result[0].source,'greenhouse');
  assert.equal(norm.canonicalUrl('https://example.com/jobs/1?utm_source=x&job=1#apply'),'https://example.com/jobs/1?job=1');
});
test('remote eligibility distinguishes clear countries and regions from unknown restrictions',()=>{
  for(const [location,description,status,scope] of [['Remote US only','Worldwide team','ineligible','countries'],['Remote Canada only','','ineligible','countries'],['Remote Turkey only','','eligible','countries'],['Remote worldwide','','eligible','worldwide'],['Remote Europe','','eligible','europe'],['Remote EU only','','ineligible','eu'],['Remote EMEA','','eligible','emea'],['Remote','','unknown','unknown']]) {
    const actual=norm.geographicEligibility(job({location,description,workplaceType:'remote'}),'tr');assert.equal(actual.status,status,location);assert.equal(actual.scope,scope,location);
  }
});
test('junior experience of two years can be a stretch; senior titles are poor for new grads',()=>{
  assert.equal(norm.seniority('Backend Developer','2 years experience',0).seniorityMatch,'stretch');
  assert.equal(norm.seniority('Senior Backend Engineer','',0).seniorityMatch,'poor');
  assert.equal(norm.seniority('Graduate Developer','',0).seniorityMatch,'strong');
});
test('country plus Remote keeps local onsite and eligible remote; freshness never uses discoveredAt',()=>{
  const {filterCollectedJobs,buildSearchPlan}=load('@jobhunt/api/jobs/discovery');
  const profile={job_titles_seeking:['Backend Developer'],preferred_locations:['Turkey','Remote'],location:'Turkey',job_boards:['direct'],remote_preference:'Any'};
  const plan=buildSearchPlan({mode:'profile'},profile);
  const jobs=[job({workplaceType:'onsite'}),job({externalId:'2',applyUrl:'https://example.com/jobs/2',location:'Remote worldwide',workplaceType:'remote'}),job({externalId:'3',applyUrl:'https://example.com/jobs/3',location:'Remote US only',workplaceType:'remote'})];
  assert.equal(filterCollectedJobs(jobs,{plan,profile}).length,2);
  assert.equal(filterCollectedJobs(jobs,{plan,profile,freshnessDays:7}).length,0);
  jobs[0].publishedAt=new Date().toISOString();assert.equal(filterCollectedJobs(jobs,{plan,profile,freshnessDays:1}).length,1);
});
test('generic extraction reads genuine JobPosting records and never turns crawler pages into jobs',()=>{
  const {structuredJobs,careerLinks,robotsAllows}=load('@jobhunt/api/jobs/providers/company');
  const source={...input,source:{...input.source,provider:'company',careerUrl:'https://example.com/careers',discoveryMethod:'company_career_page'}};
  const posting={'@type':'JobPosting',title:'Backend Developer',hiringOrganization:{name:'Example'},description:'Node.js',url:'/jobs/1',datePosted:'2026-01-01',jobLocationType:'TELECOMMUTE',applicantLocationRequirements:{'@type':'Country',name:'Turkey'}};
  const html=`<script type="application/ld+json">${JSON.stringify({'@graph':[posting]})}</script>`;
  const jobs=structuredJobs(html,'https://example.com/jobs/1',source);assert.equal(jobs.length,1);assert.equal(jobs[0].applyUrl,'https://example.com/jobs/1');assert.match(jobs[0].location,/Turkey/);
  assert.equal(structuredJobs('<title>Careers</title><p>Join us!</p>','https://example.com/careers',source).length,0);
  assert.deepEqual(careerLinks('<a href="https://jobs.ashbyhq.com/example">Careers</a><a href="http://localhost/jobs">jobs</a>','https://example.com'),['https://jobs.ashbyhq.com/example']);
  assert.equal(robotsAllows('User-agent: *\nDisallow: /private','/private/jobs'),false);
  assert.deepEqual(careerLinks('<script>self.__next_f.push([1,"jobUrl: https://jobs.ashbyhq.com/example/123"])</script>','https://example.com'),['https://jobs.ashbyhq.com/example/123']);
});
test('public HTTP rejects local, mapped, link-local and private addresses',()=>{
  const {isPublicAddress}=load('@jobhunt/api/jobs/safe-http');
  for(const ip of ['127.0.0.1','10.1.2.3','192.168.1.2','169.254.169.254','100.64.1.2','::1','::ffff:127.0.0.1','fc00::1','fe80::1'])assert.equal(isPublicAddress(ip),false,ip);
  assert.equal(isPublicAddress('1.1.1.1'),true);
});
test('ATS adapters normalize public responses using the documented endpoints',async()=>{
  const previous=global.fetch;const calls=[];
  const fixture={greenhouse:{jobs:[{id:1,internal_job_id:1,title:'Backend Developer',content:'Node.js',location:{name:'Istanbul'},absolute_url:'https://boards.greenhouse.io/example/jobs/1'}]},lever:[{id:'1',text:'Backend Developer',descriptionPlain:'Node.js',categories:{location:'Istanbul',commitment:'Full-time'},hostedUrl:'https://jobs.eu.lever.co/example/1',applyUrl:'https://jobs.eu.lever.co/example/1/apply'}],ashby:{jobs:[{title:'Backend Developer',jobUrl:'https://jobs.ashbyhq.com/example/1',applyUrl:'https://jobs.ashbyhq.com/example/1/apply',isListed:true,publishedAt:'2026-01-01',location:'Remote EMEA',descriptionPlain:'Node.js',workplaceType:'Remote'}]},smartrecruiters:{content:[{id:'1',name:'Backend Developer'}]},workable:{name:'Example',jobs:[{shortcode:'1',title:'Backend Developer',description:'Node.js',city:'Istanbul',country:'Turkey',url:'https://apply.workable.com/example/j/1/apply',shortlink:'https://apply.workable.com/example/j/1',published_on:'2026-01-01',workplace_type:'hybrid'}]}};
  global.fetch=async url=>{calls.push(url);if(url.endsWith('/jobs/1'))return Response.json({...fixture.greenhouse.jobs[0],company_name:'Example',first_published:'2026-01-01'});if(url.endsWith('/postings/1'))return Response.json({id:'1',name:'Backend Developer',company:{name:'Example'},location:{city:'Istanbul',country:'TR'},jobAd:{sections:{jobDescription:{text:'Node.js'}}},releasedDate:'2026-01-01',applyUrl:'https://jobs.smartrecruiters.com/example/1'});if(url.endsWith('/boards/example'))return Response.json({name:'Example'});const provider=url.includes('greenhouse')?'greenhouse':url.includes('lever')?'lever':url.includes('ashby')?'ashby':url.includes('smartrecruiters')?'smartrecruiters':'workable';return Response.json(fixture[provider]);};
  try {for(const [file,name] of [['greenhouse','GreenhouseProvider'],['lever','LeverProvider'],['ashby','AshbyProvider'],['smartrecruiters','SmartRecruitersProvider'],['workable','WorkableProvider']]){const Provider=load(`@jobhunt/api/jobs/providers/${file}`)[name];const result=await new Provider().fetchJobs({...input,source:{...input.source,provider:file,careerUrl:file==='lever'?'https://jobs.eu.lever.co/example':input.source.careerUrl}});assert.equal(result.length,1,file);assert.equal(result[0].source,file);assert.ok(norm.validJob(result[0]));if(file==='lever')assert.equal(result[0].publishedAt,null);}assert.ok(calls.some(url=>url.startsWith('https://api.eu.lever.co/v0/postings/example')));}finally{global.fetch=previous;}
});
test('AI failure and malformed output preserve saved valid listings with pending scores',async()=>{
  for(const failure of ['outage','invalid']) {
    const row={id:'saved1',title:'Developer',company:'Example',about_role:'Engineering role using Node.js',match_score:null,match_status:'pending'};
    const query={insert(){return query;},select(){return query;},eq(){return query;},update(){return query;},async single(){return {data:{id:'run1'}};},then(resolve){return Promise.resolve({data:[]}).then(resolve);}};
    const app=createLoader({'@jobhunt/api/jobs/admission':{async withDiscoveryLimit(_c,work){return work();},DiscoveryLimitError:class extends Error{}},'@jobhunt/api/jobs/discovery':{...load('@jobhunt/api/jobs/discovery'),async discoverJobs(){return {jobs:[job()],warnings:[]};}},'@jobhunt/api/jobs/persistence':{async saveDiscoveredJobs(){return {jobs:[row],inserted:1,updated:0};}},'@jobhunt/api/usage':{async withUsageLimit(_c,work){return work();},UsageLimitError:class extends Error{}},'@jobhunt/api/ai/completions':{async completeAI(){if(failure==='outage')throw new Error('Unavailable');return 'garbage';}},'@jobhunt/api/lib/posthog-server':{async trackPostHogEvent(){}}});
    const result=await app('@jobhunt/api/jobs/find').runJobSearch({user:{id:'owner'},database:{from(){return query;}}},{skills:[],preferred_locations:['Turkey']},{titles:['Developer'],locations:['Turkey'],boards:['direct'],targets:[],warnings:[]},null);
    assert.equal(result.jobs[0].match_score,null);assert.match(result.warnings.join(' '),/Match pending/);
  }
});
test('career cache reuses fresh results, refreshes expired/query-changed sources and uses scoped repository',async()=>{
  const {CareerSourceCache}=load('@jobhunt/api/jobs/source-cache');const calls=[];
  const rows=[{id:'1',career_url:input.source.careerUrl,discovery_method:'ats_direct',last_fetched_at:new Date().toISOString(),jobs_cache:[job()],cache_query:'query'}];
  const query={select(){return query;},order(){return query;},limit(){return query;},async rows(){return {data:rows};},update(){return query;},eq(){return query;},then(resolve){return Promise.resolve({data:[]}).then(resolve);}};
  const cache=new CareerSourceCache({database:{from(table){calls.push(table);return query;}}});await cache.load();assert.equal(cache.read(input.source,'query').length,1);assert.equal(cache.read(input.source,'other'),null);rows[0].last_fetched_at=new Date(Date.now()-31*60000).toISOString();assert.equal(cache.read(input.source,'query'),null);assert.deepEqual(calls,['career_sources']);
});
test('fresh career results avoid rediscovering known companies through Brave',async()=>{
  let discoveryCalls=0;
  class Cache {async load(){return [input.source];}read(){return [job()];}async remember(){}async touch(){}}
  class Brave {isConfigured(){return true;}async discover(){discoveryCalls++;return [];}}
  const app=createLoader({'@jobhunt/api/jobs/source-cache':{CareerSourceCache:Cache},'@jobhunt/api/jobs/providers/brave':{BraveDiscoveryProvider:Brave,discoveryQueries:()=>['query']}})('@jobhunt/api/jobs/discovery');
  const profile={job_titles_seeking:['Backend Developer'],preferred_locations:['Turkey'],job_boards:['direct'],location:'Turkey'};
  const plan=app.buildSearchPlan({mode:'profile'},profile);
  const result=await app.discoverJobs(plan.targets,{plan,profile,context:{}});
  assert.equal(result.jobs.length,1);assert.equal(discoveryCalls,0);
});
test('failed Greenhouse and Brave do not discard successful Ashby results',async()=>{
  const oldFetch=global.fetch;const oldKey=process.env.SEARCH_API_KEY;process.env.SEARCH_API_KEY='test-only';
  global.fetch=async url=>url.includes('ashby')?Response.json({jobs:[{title:'Backend Developer',jobUrl:'https://jobs.ashbyhq.com/example/1',applyUrl:'https://jobs.ashbyhq.com/example/1/apply',descriptionPlain:'Work from anywhere',location:'Remote worldwide',workplaceType:'Remote',isListed:true}]}):Response.json({}, {status:503});
  try {const app=createLoader()('@jobhunt/api/jobs/discovery');const profile={job_titles_seeking:['Backend Developer'],preferred_locations:['Remote'],job_boards:['direct'],location:'Turkey',career_urls:['https://boards.greenhouse.io/example','https://jobs.ashbyhq.com/example']};const plan=app.buildSearchPlan({mode:'profile'},profile);const result=await app.discoverJobs(plan.targets,{plan,profile});assert.equal(result.jobs.length,1);assert.equal(result.jobs[0].source,'ashby');assert.match(result.warnings.join(' '),/Brave Search unavailable/);assert.match(result.warnings.join(' '),/greenhouse: company source unavailable/);}finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.SEARCH_API_KEY;else process.env.SEARCH_API_KEY=oldKey;}
});
test('Jooble and Brave normalize configured responses without importing search snippets as jobs',async()=>{
  const oldFetch=global.fetch;const keys=[process.env.JOOBLE_API_KEY,process.env.SEARCH_API_KEY,process.env.JOOBLE_REGIONS];process.env.JOOBLE_API_KEY='test-only';process.env.SEARCH_API_KEY='test-only';process.env.JOOBLE_REGIONS=JSON.stringify({tr:{apiKey:'test-only',host:'tr.jooble.org'}});const calls=[];
  global.fetch=async(url,options)=>{calls.push({url,options});return Response.json(url.includes('jooble')?{jobs:[{id:'j1',title:'Backend Developer',company:'Example',snippet:'Node.js',location:'Istanbul',link:'https://example.com/jobs/1',updated:new Date().toISOString()}]}:{web:{results:[{url:'https://jobs.ashbyhq.com/example/1',title:'Backend Developer',description:'A search snippet'},{url:'https://linkedin.com/jobs/view/1'}]}});};
  try {const Jooble=load('@jobhunt/api/jobs/providers/jooble').JoobleProvider;const jobs=await new Jooble().search({title:'Backend Developer',location:'Istanbul',remote:false,board:'jooble',country:'tr'},AbortSignal.timeout(10000));assert.equal(jobs.length,1);assert.equal(jobs[0].publishedAt,null);const Brave=load('@jobhunt/api/jobs/providers/brave').BraveDiscoveryProvider;const sources=await new Brave().discover('Backend Istanbul',AbortSignal.timeout(10000));assert.equal(sources.length,1);assert.equal(sources[0].provider,'ashby');assert.equal(sources[0].discoveryMethod,'search_discovery');assert.equal(sources[0].description,undefined);assert.equal(new URL(calls[0].url).hostname,'tr.jooble.org');assert.equal(calls[0].options.method,'POST');assert.equal(calls[1].options.headers['X-Subscription-Token'],'test-only');}finally{global.fetch=oldFetch;for(const [i,name] of ['JOOBLE_API_KEY','SEARCH_API_KEY','JOOBLE_REGIONS'].entries()){if(keys[i]===undefined)delete process.env[name];else process.env[name]=keys[i];}}
});
