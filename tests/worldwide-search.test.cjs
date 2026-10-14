const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createLoader}=require('./load-ts.cjs');
const load=createLoader();
const countries=load('@jobhunt/shared/countries');
const discovery=load('@jobhunt/api/jobs/discovery');
const profile={location:'Turkey',job_titles_seeking:['Developer'],preferred_locations:['Turkey'],job_boards:['direct','linkedin','jooble'],remote_preference:'Any'};

test('every selectable country routes to its own ISO code, without US fallback',()=>{
  assert.equal(countries.COUNTRIES.length,249);
  for(const {code,name} of countries.COUNTRIES) {
    const plan=discovery.buildSearchPlan(discovery.parseSearchRequest({mode:'manual',jobTitle:'Developer',location:'',country:code}),profile);
    assert.equal(countries.countryForLocation(name),code,name);
    assert.equal(plan.targets.length,3);
    assert.ok(plan.targets.every(target=>target.country===code),name);
  }
  assert.equal(countries.countryForLocation('Unknown city'),'');
  const plan=discovery.buildSearchPlan({mode:'manual',jobTitle:'Developer',location:'Unknown city'},profile);
  assert.ok(plan.targets.every(target=>target.board==='direct'));
  assert.match(plan.warnings.join(' '),/Choose a country/);
  assert.throws(()=>discovery.parseSearchRequest({mode:'manual',jobTitle:'Developer',location:'',country:'invalid'}));
});

test('city and country are preserved; Remote uses the selected market',()=>{
  for(const [country,city] of [['jp','Tokyo'],['br','Recife'],['ke','Nairobi'],['tr','Istanbul'],['de','Hamburg'],['au','Melbourne']]) {
    const plan=discovery.buildSearchPlan({mode:'manual',jobTitle:'Developer',location:city,country},profile);
    assert.ok(plan.targets.every(t=>t.country===country));
    assert.ok(plan.locations[0].startsWith(city+', '));
    const remote=discovery.buildSearchPlan({mode:'manual',jobTitle:'Developer',location:'Remote',country},profile);
    assert.ok(remote.targets.every(t=>t.remote && t.country===country));
  }
});

test('remote restrictions cover countries worldwide and avoid incidental mentions',()=>{
  const {geographicEligibility}=load('@jobhunt/api/jobs/normalization');
  for(const [location,country] of [['Remote Japan','jp'],['Remote Brazil','br'],['Remote Kenya','ke'],['Remote Germany','de'],['Remote Papua New Guinea','pg']]) {
    const job={location,description:'',workplaceType:'remote'};
    assert.equal(geographicEligibility(job,country).status,'eligible');
    assert.equal(geographicEligibility(job,'tr').status,'ineligible');
    assert.deepEqual(geographicEligibility(job,country).countries,[country]);
  }
  assert.equal(geographicEligibility({location:'Remote',description:'Join us. Our clients are in Japan.',workplaceType:'remote'},'tr').status,'unknown');
  assert.equal(geographicEligibility({location:'Remote worldwide',description:'Must be based in Japan',workplaceType:'remote'},'tr').status,'ineligible');
});

test('Jooble isolates regional keys and rejects untrusted hosts',async()=>{
  const keys=['JOOBLE_API_KEY','JOOBLE_COUNTRY','JOOBLE_HOST','JOOBLE_REGIONS'];
  const saved=keys.map(key=>process.env[key]);const oldFetch=global.fetch;const calls=[];
  try {
    for(const key of keys) delete process.env[key];
    process.env.JOOBLE_API_KEY='us-test';
    process.env.JOOBLE_REGIONS=JSON.stringify({tr:{apiKey:'tr-test',host:'tr.jooble.org'},gb:{apiKey:'uk-test',host:'uk.jooble.org'},de:{apiKey:'secret',host:'evil.example'}});
    global.fetch=async url=>{calls.push(url);return Response.json({jobs:[]});};
    const provider=new (load('@jobhunt/api/jobs/providers/jooble').JoobleProvider)();
    assert.equal(provider.isConfigured('de'),false);assert.equal(provider.isConfigured('jp'),false);
    for(const country of ['tr','gb','us','jp']) await provider.search({title:'Developer',location:'',country,remote:false,board:'jooble'},AbortSignal.timeout(10000));
    assert.deepEqual(calls.map(url=>new URL(url).hostname),['tr.jooble.org','uk.jooble.org','jooble.org']);
    assert.deepEqual(calls.map(url=>new URL(url).pathname),['/api/tr-test','/api/uk-test','/api/us-test']);
  } finally {global.fetch=oldFetch;keys.forEach((key,i)=>saved[i]===undefined?delete process.env[key]:process.env[key]=saved[i]);}
});

test('company requests retry one temporary failure and diagnostics redact raw errors',async()=>{
  const {json}=load('@jobhunt/api/jobs/providers/common');
  const {providerDiagnostic,providerFailureHint}=load('@jobhunt/api/lib/provider-diagnostics');
  const oldFetch=global.fetch;let calls=0;
  try {
    global.fetch=async()=>++calls===1?Response.json({}, {status:503}):Response.json({jobs:[]});
    assert.deepEqual(await json('https://api.ashbyhq.com/example',AbortSignal.timeout(5000)),{jobs:[]});
    assert.equal(calls,2);
    calls=0;global.fetch=async()=>{calls++;return Response.json({private:'secret'}, {status:404});};
    await assert.rejects(json('https://api.ashbyhq.com/example',AbortSignal.timeout(5000)),error=>{
      assert.deepEqual(providerDiagnostic(error),{category:'not_found',httpStatus:404});
      assert.match(providerFailureHint(error),/Career board not found/);return true;
    });assert.equal(calls,1);
    assert.deepEqual(providerDiagnostic({status:503,message:'secret-key',headers:{authorization:'secret-key'},url:'https://example.com/secret-key'}),{category:'service_unavailable',httpStatus:503});
    assert.deepEqual(providerDiagnostic(new DOMException('secret-key','TimeoutError')),{category:'timeout'});
  } finally {global.fetch=oldFetch;}
});
