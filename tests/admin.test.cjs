const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createLoader } = require("./load-ts.cjs");
function setup({ user = { id: "admin-id" }, admin = true, dbError = null, missing = false, configured = true } = {}) {
  const calls = [];
  let provider = "gemini";
  const query = {
    select: () => query,
    eq: (key, value) => { calls.push(["filter",key,value]); return query; },
    update: value => { calls.push(["write",value]); provider = value.provider; return query; },
    maybeSingle: async () => ({ data: missing ? null : {provider,updated_at:"2026-10-10T12:00:00Z"}, error:dbError }),
  };
  const context = { user, database:{from:name=>{calls.push(["table",name]);return query;}} };
  const load = createLoader({
    "@jobhunt/api/admin/authorization": {isAdminUser:async()=>admin},
    "@jobhunt/api/ai/config": {getProviderConfig:()=>{if(!configured)throw new Error("No key");}},
    "@jobhunt/api/database/pool": {getPool:()=>({query:async()=>{if(dbError)throw new Error("Database outage");return {rows:missing?[]:[{provider,updated_at:"2026-10-10T12:00:00Z"}]};}})},
  });
  return {load,calls,context};
}
async function save(setup,provider) {return setup.load("@jobhunt/api/admin/service").saveAIProvider(provider,setup.context);}
test("unauthenticated and non-admin users cannot mutate provider settings",async()=>{
  for(const options of [{user:null},{admin:false}]) {const state=setup(options);assert.equal((await save(state,"groq")).success,false);assert.deepEqual(state.calls,[]);}
});
test("invalid and unconfigured providers are rejected before database write",async()=>{
  for(const provider of [null,"attacker-provider",{},"GEMINI"]) {const state=setup();assert.equal((await save(state,provider)).success,false);assert.deepEqual(state.calls,[]);}
  const state=setup({configured:false});assert.equal((await save(state,"groq")).success,false);assert.deepEqual(state.calls,[]);
});
test("admin saves only global settings with audit identity",async()=>{
  const state=setup();assert.equal((await save(state,"groq")).success,true);
  assert.deepEqual(state.calls.find(([kind])=>kind==="write"),["write",{provider:"groq",updated_by:"admin-id"}]);
  assert.ok(state.calls.some(([kind,key,value])=>kind==="filter"&&key==="id"&&value==="global"));
  assert.equal((await state.load("@jobhunt/api/ai/settings").getAISettings()).provider,"groq");
});
test("database rejection or missing settings never report save success",async()=>{
  for(const options of [{dbError:{code:"42501"}},{missing:true}]) assert.equal((await save(setup(options),"openai")).success,false);
});
test("settings outages and incomplete migrations fail safely",async()=>{
  for(const options of [{missing:true},{dbError:{code:"42P01"}},{dbError:{code:"NETWORK_ERROR"}}]) await assert.rejects(setup(options).load("@jobhunt/api/ai/settings").getAISettings());
});
