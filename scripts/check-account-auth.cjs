#!/usr/bin/env node
/** Offline only: real handlers and actual HTML, synthetic transport and identities. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const results = [];
const origin = 'https://ovuluna.test';
const names = { csrf:'__Host-ov-csrf', flow:'__Host-ov-auth-flow', email:'__Host-ov-email-flow', access:'__Host-ov-account', refresh:'__Host-ov-account-refresh' };
const env = { OVULUNA_ACCOUNT_APP_URL:origin, OVULUNA_ACCOUNT_BACKEND_CONFIRMED:'true', OVULUNA_SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co', OVULUNA_SUPABASE_ANON_KEY:'sb_publishable_synthetic_not_a_real_key', OVULUNA_AUTH_COOKIE_KEY:Buffer.alloc(32, 7).toString('base64'), OVULUNA_AUTH_GOOGLE_ENABLED:'true', OVULUNA_AUTH_APPLE_ENABLED:'true', OVULUNA_AUTH_EMAIL_ENABLED:'true', OVULUNA_AUTH_EMAIL_SMTP_CONFIRMED:'true' };
const user = { id:'11111111-1111-4111-8111-111111111111', email:'synthetic@example.invalid', email_confirmed_at:'2026-10-01T00:00:00Z', role:'authenticated', is_anonymous:false, identities:[{provider:'google'},{provider:'apple'},{provider:'email'}] };
const tokens = { access_token:'synthetic-access-token-not-a-real-jwt', refresh_token:'synthetic-refresh-token-not-a-real-token', token_type:'bearer', expires_in:60 };
const json = (data, status=200) => new Response(JSON.stringify(data), { status, headers:{'Content-Type':'application/json'} });
let createAccountAuth;
async function test(name, work) { await work(); results.push(name); console.log('PASS '+name); }
function harness(overrides = {}) {
  let time = Date.parse('2026-10-01T00:00:00Z'), jar = {}, calls = [], responder = null;
  const auth = createAccountAuth({ env:overrides.env || env, now:()=>time, fetchImpl:async(url, options)=>{
    calls.push({url,options});
    if (responder) { const result = await responder(url, options); if (result) return result; }
    if (url.endsWith('/user')) return json(overrides.user || user);
    if (url.includes('/token?') || url.endsWith('/verify')) return json(overrides.tokens || tokens);
    if (url.includes('/logout?')) return new Response(null,{status:204});
    if (url.endsWith('/otp')) return json({message:'Eligible requests receive an email'});
    throw new Error('Unexpected synthetic upstream '+url);
  }});
  async function invoke(action, input, options={}) {
    const headers={host:'ovuluna.test',...(input ? {origin,'content-type':'application/json','sec-fetch-site':'same-origin'} : {}),cookie:Object.entries(options.jar || jar).map(([k,v])=>k+'='+v).join('; '),...options.headers};
    for(const [key,value] of Object.entries(headers)) if(value===null) delete headers[key];
    const req={method:options.method || (input?'POST':'GET'),headers,body:input,url:options.url || '/api/auth-'+action};
    const out={headers:{},code:200,data:null,setHeader(k,v){this.headers[k.toLowerCase()]=v},getHeader(k){return this.headers[k.toLowerCase()]},status(v){this.code=v;return this},json(v){this.data=v;return this},end(){return this}};
    await auth.dispatch(action,req,out);
    if(options.capture!==false) for(const c of out.headers['set-cookie'] || []) {const [pair]=c.split(';');const at=pair.indexOf('=');if(/Max-Age=0(?:;|$)/.test(c))delete jar[pair.slice(0,at)];else jar[pair.slice(0,at)]=pair.slice(at+1);}
    return out;
  }
  return {invoke,calls,get jar(){return jar},set jar(v){jar=v},advance(ms){time+=ms},respond(fn){responder=fn}};
}
async function csrfFor(h){return (await h.invoke('status')).data.csrfToken}
async function oauth(h,provider='google') {
  const csrfToken=await csrfFor(h), start=await h.invoke('start',{provider,csrfToken});
  assert.equal(start.code,200);
  const url=new URL(start.data.authorizationUrl), callback=new URL(url.searchParams.get('redirect_to'));
  const finish=await h.invoke('callback',null,{url:callback.pathname+callback.search+'&code=synthetic-code'});
  return {csrfToken,url,callback,finish};
}

(async()=>{
  ({createAccountAuth}=await import(pathToFileURL(path.join(root,'api/_lib/account-auth.mjs'))));
  await test('Missing configuration is unavailable, with no provider calls or phantom login',async()=>{
    const h=harness({env:{}}),s=await h.invoke('status');assert.equal(s.code,200);assert.equal(s.data.available,false);assert.equal(s.data.authenticated,false);assert.equal(s.data.csrfToken,null);assert.deepEqual(s.data.providers,{email:false,google:false,apple:false});assert.equal(h.calls.length,0);assert.equal((await h.invoke('start',{provider:'google',csrfToken:'x'})).code,503);
  });
  await test('Explicit ownership, HTTPS origins, 32-byte key, and nonprivileged hosted backend are required',async()=>{
    for(const change of [{OVULUNA_ACCOUNT_BACKEND_CONFIRMED:'false'},{OVULUNA_ACCOUNT_APP_URL:'http://ovuluna.test'},{OVULUNA_ACCOUNT_APP_URL:'https://ovuluna.test/other'},{OVULUNA_SUPABASE_URL:'https://127.0.0.1'},{OVULUNA_AUTH_COOKIE_KEY:'bad'},{OVULUNA_SUPABASE_ANON_KEY:'sb_secret_should_never_be_used'}]) {const h=harness({env:{...env,...change}});assert.equal((await h.invoke('status')).data.available,false);assert.equal(h.calls.length,0);}
  });
  await test('Provider flags are independent and email requires custom SMTP confirmation',async()=>{
    const h=harness({env:{...env,OVULUNA_AUTH_GOOGLE_ENABLED:'false',OVULUNA_AUTH_EMAIL_SMTP_CONFIRMED:'false'}}),s=await h.invoke('status');assert.deepEqual(s.data.providers,{google:false,apple:true,email:false});assert.equal((await h.invoke('start',{provider:'google',csrfToken:s.data.csrfToken})).code,503);assert.equal((await h.invoke('email',{action:'request',email:user.email,createUser:true,csrfToken:s.data.csrfToken})).code,503);
  });
  await test('Exact mandatory Origin, Host, fetch metadata and method checks reject forged POSTs',async()=>{
    const h=harness(),csrfToken=await csrfFor(h),input={provider:'google',csrfToken};
    for(const headers of [{origin:null},{origin:'https://evil.invalid'},{host:'evil.invalid'},{'sec-fetch-site':'cross-site'},{'sec-fetch-mode':'navigate'}])assert.equal((await h.invoke('start',input,{headers})).code,403);
    assert.equal((await h.invoke('start',input,{method:'GET'})).code,405);assert.equal(h.calls.length,0);
  });
  await test('Stable sealed CSRF rejects wrong/Unicode values without server error',async()=>{
    const h=harness(),csrfToken=await csrfFor(h);assert.equal(await csrfFor(h),csrfToken);
    for(const bad of ['bad', 'é'.repeat(43),csrfToken.slice(0,-1)+'!']){const r=await h.invoke('start',{provider:'google',csrfToken:bad});assert.equal(r.code,403);}
    const cookie=(await harness().invoke('status')).headers['set-cookie'][0];assert.match(cookie,/Secure; HttpOnly; SameSite=Lax/);assert.match(cookie,/Path=\//);assert.ok(cookie.length<4096);assert.equal(h.calls.length,0);
  });
  await test('OAuth own state is in the fixed callback URL; S256 verifier stays server-only',async()=>{
    const h=harness(),csrfToken=await csrfFor(h),s=await h.invoke('start',{provider:'google',csrfToken}),url=new URL(s.data.authorizationUrl),callback=new URL(url.searchParams.get('redirect_to'));
    assert.equal(url.origin,env.OVULUNA_SUPABASE_URL);assert.equal(callback.origin,origin);assert.equal(callback.pathname,'/api/auth-callback');assert.match(callback.searchParams.get('state'),/^[\w-]{43}$/);assert.equal(url.searchParams.get('code_challenge_method'),'s256');assert.equal(url.searchParams.has('state'),false);assert.equal(s.data.verifier,undefined);
    const r=await h.invoke('callback',null,{url:callback.pathname+callback.search+'&code=synthetic-code&next=https://evil.invalid'});assert.equal(r.code,303);assert.equal(r.headers.location,origin+'/account.html?auth=complete');
    const exchange=h.calls.find(c=>c.url.includes('grant_type=pkce')),value=JSON.parse(exchange.options.body);assert.equal(crypto.createHash('sha256').update(value.code_verifier).digest('base64url'),url.searchParams.get('code_challenge'));assert.ok(h.calls.some(c=>c.url.endsWith('/user')));
    for(const cookie of r.headers['set-cookie'])assert.ok(cookie.length<4096);assert.doesNotMatch(JSON.stringify(r.data),/synthetic-access|synthetic-refresh/);
  });
  await test('Wrong/missing/duplicate state and duplicate cookies fail before token exchange',async()=>{
    const h=harness(),csrfToken=await csrfFor(h),s=await h.invoke('start',{provider:'apple',csrfToken}),callback=new URL(new URL(s.data.authorizationUrl).searchParams.get('redirect_to')),oldFlow=h.jar[names.flow];
    assert.equal((await h.invoke('callback',null,{url:'/api/auth-callback?code=c&state=wrong'})).code,403);assert.equal(h.jar[names.flow],oldFlow);
    assert.equal((await h.invoke('callback',null,{url:callback.pathname+callback.search+'&state=duplicate&code=c'})).code,400);
    assert.equal((await h.invoke('status',null,{headers:{cookie:names.csrf+'='+h.jar[names.csrf]+'; '+names.csrf+'='+h.jar[names.csrf]}})).code,400);assert.equal(h.calls.length,0);
  });
  await test('Cancelled/errors are sanitized and expired OAuth flow cannot be exchanged',async()=>{
    const h=harness(),csrfToken=await csrfFor(h),s=await h.invoke('start',{provider:'apple',csrfToken}),callback=new URL(new URL(s.data.authorizationUrl).searchParams.get('redirect_to'));
    const r=await h.invoke('callback',null,{url:callback.pathname+callback.search+'&error=access_denied&error_description=PRIVATE_TOKEN'});assert.equal(r.code,303);assert.equal(r.headers.location,origin+'/account.html?auth=cancelled');assert.doesNotMatch(JSON.stringify(r),/PRIVATE_TOKEN/);assert.equal(h.calls.length,0);
    const h2=harness(),c2=await csrfFor(h2),s2=await h2.invoke('start',{provider:'google',csrfToken:c2}),cb2=new URL(new URL(s2.data.authorizationUrl).searchParams.get('redirect_to'));h2.advance(601000);assert.equal((await h2.invoke('callback',null,{url:cb2.pathname+cb2.search+'&code=c'})).code,401);assert.equal(h2.calls.length,0);
  });
  await test('OAuth provider exchange or server-user rejection never creates a login',async()=>{
    for(const failure of ['exchange','user','identity']){const h=harness();h.respond((url)=>url.includes('grant_type=pkce')&&failure==='exchange'?json({private:'secret'},400):url.endsWith('/user')&&failure==='user'?json({private:'secret'},401):url.endsWith('/user')&&failure==='identity'?json({...user,identities:[{provider:'email'}],user_metadata:{provider:'google'}}):null);const {finish}=await oauth(h);assert.equal(finish.headers.location,origin+'/account.html?auth=failed');assert.equal(h.jar[names.access],undefined);assert.equal(h.jar[names.refresh],undefined);}
  });
  await test('Session identity is revalidated with getUser on every status; no token leaks',async()=>{
    const h=harness();await oauth(h);const first=await h.invoke('status');assert.equal(first.data.authenticated,true);assert.equal(first.data.user.id,user.id);assert.equal(first.data.user.provider,'google');assert.equal(first.data.records,'device-only');assert.equal(first.data.accountDeletion.available,false);assert.doesNotMatch(JSON.stringify(first.data),/synthetic-access|synthetic-refresh|access_token|refresh_token/);const count=h.calls.length;await h.invoke('status');assert.equal(h.calls.length,count+1);h.respond(url=>url.endsWith('/user')?json({error:'revoked'},401):null);const invalid=await h.invoke('status');assert.equal(invalid.data.authenticated,false);assert.equal(invalid.data.user,null);assert.equal(invalid.data.sessionState,'unverified');
  });
  await test('Email request alone is not login, with explicit create_user and encrypted email binding',async()=>{
    const h=harness(),csrfToken=await csrfFor(h),r=await h.invoke('email',{action:'request',email:user.email,createUser:false,csrfToken});assert.equal(r.code,200);assert.equal(r.data.authenticated,false);assert.equal(h.jar[names.access],undefined);assert.equal(h.jar[names.refresh],undefined);assert.ok(h.jar[names.email]);assert.doesNotMatch(h.jar[names.email],/synthetic@example/);assert.deepEqual(JSON.parse(h.calls[0].options.body),{email:user.email,create_user:false});assert.equal(h.calls.length,1);
  });
  await test('Email verification is bound to request cookie, then getUser confirms matching email',async()=>{
    const h=harness(),csrfToken=await csrfFor(h);await h.invoke('email',{action:'request',email:user.email,createUser:true,csrfToken});
    assert.equal((await h.invoke('email',{action:'verify',code:'123456',email:'attacker@example.invalid',csrfToken})).code,400);assert.equal(h.calls.length,1);
    assert.equal((await h.invoke('email',{action:'verify',code:'abc123',csrfToken})).code,400);
    const r=await h.invoke('email',{action:'verify',code:'123456',csrfToken});assert.equal(r.code,200);assert.ok(h.jar[names.access]);assert.equal(h.jar[names.email],undefined);assert.deepEqual(JSON.parse(h.calls.find(c=>c.url.endsWith('/verify')).options.body),{email:user.email,token:'123456',type:'email'});assert.equal((await h.invoke('status')).data.user.provider,'email');
  });
  await test('Invalid/expired email code or unconfirmed/mismatched server email stays signed out',async()=>{
    for(const cause of ['invalid','email','unconfirmed','expired']){const h=harness(),csrfToken=await csrfFor(h);await h.invoke('email',{action:'request',email:user.email,createUser:false,csrfToken});h.respond(url=>url.endsWith('/verify')&&cause==='invalid'?json({error:'SECRET'},400):url.endsWith('/user')&&cause==='email'?json({...user,email:'different@example.invalid'}):url.endsWith('/user')&&cause==='unconfirmed'?json({...user,email_confirmed_at:null}):null);if(cause==='expired')h.advance(601000);const r=await h.invoke('email',{action:'verify',code:'123456',csrfToken});assert.equal(r.code,401);assert.equal(h.jar[names.access],undefined);assert.doesNotMatch(JSON.stringify(r.data),/SECRET/);}
  });
  await test('Refresh is explicit, keeps absolute lifetime and subject, and coalesces same-instance requests',async()=>{
    const h=harness();await oauth(h);h.advance(50000);const s=await h.invoke('status');assert.equal(s.data.authenticated,false);assert.equal(s.data.refreshAvailable,true);assert.equal(h.calls.filter(c=>c.url.includes('grant_type=refresh_token')).length,0);
    const jar={...h.jar};const replies=await Promise.all([h.invoke('refresh',{csrfToken:s.data.csrfToken},{jar}),h.invoke('refresh',{csrfToken:s.data.csrfToken},{jar})]);assert.ok(replies.every(r=>r.code===200));assert.equal(h.calls.filter(c=>c.url.includes('grant_type=refresh_token')).length,1);assert.equal((await h.invoke('status')).data.authenticated,true);
    h.advance(86400000);const expired=await h.invoke('status');assert.equal(expired.data.authenticated,false);assert.equal(expired.data.refreshAvailable,false);
  });
  await test('Wrong refresh subject or provider failure cannot silently restore a session',async()=>{
    for(const cause of ['subject','provider']){const h=harness();await oauth(h);h.advance(50000);const s=await h.invoke('status');h.respond(url=>url.includes('grant_type=refresh_token')&&cause==='provider'?json({error:'SECRET'},400):url.endsWith('/user')&&cause==='subject'?json({...user,id:'22222222-2222-4222-8222-222222222222'}):null);const raw={...h.jar},r=await h.invoke('refresh',{csrfToken:s.data.csrfToken});assert.equal(r.code,401);assert.equal(h.jar[names.access],raw[names.access]);assert.equal(h.jar[names.refresh],raw[names.refresh]);assert.doesNotMatch(JSON.stringify(r.data),/SECRET/);}
  });
  await test('Held refresh cannot reissue account cookies after concurrent logout on this process',async()=>{
    const h=harness();await oauth(h);h.advance(50000);const s=await h.invoke('status'),old={...h.jar};
    let release,entered;const reached=new Promise(r=>entered=r);h.respond(url=>{if(url.endsWith('/user')){entered();return new Promise(resolve=>release=()=>resolve(json(user)));}return null;});
    const pending=h.invoke('refresh',{csrfToken:s.data.csrfToken},{jar:old});await reached;
    const ended=await h.invoke('signout',{csrfToken:s.data.csrfToken},{jar:old});assert.equal(ended.data.remoteRevoked,true);assert.equal(h.jar[names.access],undefined);
    release();const refreshed=await pending;assert.equal(refreshed.code,401);assert.equal(refreshed.data.error.code,'session_ended');assert.equal(refreshed.headers['set-cookie'],undefined);assert.equal(h.jar[names.access],undefined);assert.equal((await h.invoke('refresh',{csrfToken:s.data.csrfToken},{jar:old})).code,401);
  });
  await test('Successful signout revokes local GoTrue refresh session and expires only auth cookies',async()=>{
    const h=harness();await oauth(h);const csrfToken=await csrfFor(h),r=await h.invoke('signout',{csrfToken});assert.equal(r.data.signedOut,true);assert.equal(r.data.remoteRevoked,true);assert.ok(h.calls.some(c=>c.url.endsWith('/logout?scope=local')&&c.options.method==='POST'));assert.equal(h.jar[names.access],undefined);assert.equal(h.jar[names.refresh],undefined);assert.ok(h.jar[names.csrf]);assert.equal((await h.invoke('status')).data.authenticated,false);assert.equal((await h.invoke('start',{provider:'google',csrfToken})).code,200);
  });
  await test('Provider 401/502 and malformed/expired sessions can be removed locally without claiming remote revocation',async()=>{
    for(const cause of ['401','502','malformed','expired']){const h=harness();await oauth(h);if(cause==='expired')h.advance(86401000);const csrfToken=await csrfFor(h);if(cause==='malformed')h.jar[names.access]='broken!';h.respond(url=>url.includes('/logout?')?json({private:'SECRET'},Number(cause)||502):null);const r=await h.invoke('signout',{csrfToken});assert.equal(r.code,200);assert.equal(r.data.remoteRevoked,false);assert.match(r.data.message,/could not be confirmed revoked/);assert.equal(h.jar[names.access],undefined);assert.equal(h.jar[names.refresh],undefined);assert.doesNotMatch(JSON.stringify(r.data),/SECRET/);assert.equal((await h.invoke('start',{provider:'google',csrfToken})).code,200);}
  });
  await test('Tampered/mismatched cookie pair fails closed; oversized provider tokens create no cookie pair',async()=>{
    const h=harness();await oauth(h);h.jar[names.refresh]=h.jar[names.refresh].slice(0,-4)+'AAAA';assert.equal((await h.invoke('status')).data.authenticated,false);
    const huge=harness({tokens:{...tokens,access_token:'x'.repeat(3000)}}),{finish}=await oauth(huge);assert.equal(finish.headers.location,origin+'/account.html?auth=failed');assert.equal(huge.jar[names.access],undefined);assert.equal(huge.jar[names.refresh],undefined);
  });
  await test('Deletion is fail-closed and CSRF required; JSON bounds and open redirects are rejected',async()=>{
    const h=harness(),csrfToken=await csrfFor(h);assert.equal((await h.invoke('delete',{csrfToken:'bad'})).code,403);const r=await h.invoke('delete',{csrfToken});assert.equal(r.code,501);assert.match(r.data.error.message,/not enabled/);assert.equal(h.calls.length,0);assert.equal((await h.invoke('start',{provider:'google',csrfToken,next:'https://evil.invalid'})).code,400);assert.equal((await h.invoke('start',{provider:'google',csrfToken},{headers:{'content-type':'text/plain'}})).code,415);assert.equal((await h.invoke('start',{provider:'x'.repeat(9000),csrfToken})).code,400);
  });
  await test('Upstream redirects/non-JSON/oversized bodies/network failures are bounded and sanitized',async()=>{
    for(const cause of ['nonjson','oversize','network']){const h=harness();h.respond((url,options)=>{assert.equal(options.redirect,'error');assert.ok(options.signal);if(url.includes('grant_type=pkce')) {if(cause==='network')throw new Error('DNS_SECRET');if(cause==='nonjson')return new Response('<html>SECRET</html>',{headers:{'Content-Type':'text/html'}});return json({large:'x'.repeat(70000)});}return null;});const {finish}=await oauth(h);assert.equal(finish.headers.location,origin+'/account.html?auth=failed');assert.equal(h.jar[names.access],undefined);}
  });
  await test('Per-instance OTP throttle limits repeated requests without storing raw email in response',async()=>{
    const h=harness(),csrfToken=await csrfFor(h);assert.equal((await h.invoke('email',{action:'request',email:user.email,createUser:false,csrfToken})).code,200);assert.equal((await h.invoke('email',{action:'request',email:user.email,createUser:false,csrfToken})).code,429);assert.equal(h.calls.length,1);
  });
  const source=fs.readFileSync(path.join(root,'auth-account.js'),'utf8'),html=fs.readFileSync(path.join(root,'account.html'),'utf8');
  await test('Account client contains no token persistence, ghost identity, Premium entitlement, or provider secret',async()=>{assert.doesNotMatch(source,/localStorage|sessionStorage|document\.cookie|access_token|refresh_token|client_secret/);assert.match(html,/does not upload, encrypt or sync/);assert.match(html,/Delete server account · not available/);assert.match(html,/id="account-deletion"/);assert.match(html,/privacy\.html#privacy-local-title/);});
  // Optional existing JSDOM dependency; do not install an app runtime dependency.
  let JSDOM;
  try{({JSDOM}=require(process.env.OVULUNA_JSDOM_PATH||'jsdom'));}catch(failure){throw new Error('Set OVULUNA_JSDOM_PATH to the existing test-only jsdom package: '+failure.message);}
  function ui(respond, runtime, options={}) {
    const dom=new JSDOM(html,{url:origin+'/account.html?auth=complete',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
    const requests=[],lockNames=[];w.AbortController=AbortController;if(runtime)w.OvulunaRuntime=runtime;
    if(options.channel)w.BroadcastChannel=options.channel;
    if(options.locks!==false)w.navigator.locks=options.locks||{request:async(name,work)=>{lockNames.push(name);return work()}};
    w.fetch=async(url,opts)=>{requests.push({url,options:opts});return respond(url,opts)};w.eval(source);
    return {dom,w,d:w.document,requests,lockNames,async settle(){for(let i=0;i<12;i++)await new Promise(r=>setTimeout(r,0))},close(){dom.window.close()}};
  }
  const signedout={available:true,authenticated:false,providers:{email:true,google:false,apple:true},csrfToken:'a'.repeat(43),sessionState:'signed-out',refreshAvailable:false,user:null};
  await test('Actual account HTML stays honest when API missing/HTML/unexpected shape/network down and supports retry',async()=>{
    for(const mode of ['html','shape','network','unconfigured']){const u=ui(async()=>{if(mode==='html')return new Response('<html>404_NOT_JSON</html>',{status:404});if(mode==='shape')return json({authenticated:true,user:{email:'FAKE'}});if(mode==='network')throw new Error('SECRET_DNS');return json({...signedout,available:false,providers:{email:false,google:false,apple:false},csrfToken:null,sessionState:'unavailable'});});await u.settle();assert.equal(u.d.getElementById('account-signed-in').hidden,true);assert.equal(u.d.getElementById('account-google').disabled,true);assert.doesNotMatch(u.d.getElementById('account-status').textContent,/SECRET_DNS|404_NOT_JSON|SyntaxError|FAKE/);assert.match(u.d.getElementById('account-status').textContent,/not configured|unavailable/);if(mode!=='unconfigured'){assert.equal(u.d.getElementById('account-recovery').hidden,false);u.d.getElementById('account-recheck').click();await u.settle();assert.ok(u.requests.length>=2);}u.close();}
  });
  await test('Native account HTML makes no BFF calls and never offers fake OAuth',async()=>{const u=ui(async()=>{throw new Error('Must not fetch')},{platform:'ios-development',apiBase:null});await u.settle();assert.equal(u.requests.length,0);assert.match(u.d.getElementById('account-status').textContent,/Native account sign-in is not connected/);assert.equal(u.d.getElementById('account-apple').disabled,true);u.close();});
  await test('Account OTP UI requires verification plus fresh server status, and never treats send as login',async()=>{
    let verified=false;const u=ui(async(url,opts)=>{const b=opts.body&&JSON.parse(opts.body);if(url.endsWith('auth-status'))return json(verified?{...signedout,authenticated:true,sessionState:'verified',user:{id:user.id,email:user.email,provider:'email'}}:signedout);if(b.action==='request')return json({sent:true,authenticated:false,message:'If eligible, a code was sent. Sending is not sign-in.'});verified=true;return json({authenticated:true});});await u.settle();u.d.getElementById('account-email').value=user.email;u.d.getElementById('account-email-form').dispatchEvent(new u.w.Event('submit',{cancelable:true}));await u.settle();assert.equal(u.d.getElementById('account-signed-in').hidden,true);assert.equal(u.d.getElementById('account-code-form').hidden,false);u.d.getElementById('account-code').value='123456';u.d.getElementById('account-code-form').dispatchEvent(new u.w.Event('submit',{cancelable:true}));await u.settle();assert.equal(u.d.getElementById('account-signed-in').hidden,false);assert.match(u.d.getElementById('account-identity').textContent,/email code/);assert.equal(u.requests.filter(r=>r.url.endsWith('auth-status')).length,2);assert.equal(JSON.parse(u.requests.find(r=>r.options.body&&JSON.parse(r.options.body).action==='verify').options.body).email,undefined);u.close();
  });
  await test('Account identity is hidden and rechecked after focus; provider-failed signout retains honest local-only message',async()=>{
    let ended=false;const u=ui(async(url)=>url.endsWith('auth-signout')?(ended=true,json({signedOut:true,remoteRevoked:false,message:'Browser removed. Provider session could not be confirmed revoked.'})):json(ended?signedout:{...signedout,authenticated:true,sessionState:'verified',user:{id:user.id,email:user.email,provider:'google'}}));await u.settle();assert.equal(u.d.getElementById('account-signed-in').hidden,false);u.w.dispatchEvent(new u.w.Event('focus'));await u.settle();assert.equal(u.requests.filter(r=>r.url.endsWith('auth-status')).length,2);u.d.getElementById('account-signout').click();await u.settle();assert.equal(u.d.getElementById('account-signed-in').hidden,true);assert.match(u.d.getElementById('account-status').textContent,/could not be confirmed revoked/);assert.deepEqual(u.lockNames,['ovuluna-account-mutation']);u.close();
  });
  await test('Refresh and signout share one Web Lock across tabs; logout waits for the active refresh',async()=>{
    let tail=Promise.resolve(),release,entered;const reached=new Promise(r=>entered=r),order=[],locks={request(name,work){assert.equal(name,'ovuluna-account-mutation');const next=tail.then(work);tail=next.catch(()=>{});return next}};
    const status={...signedout,sessionState:'needs-refresh',refreshAvailable:true};
    const a=ui(async(url)=>{if(url.endsWith('auth-refresh')){order.push('refresh-start');entered();await new Promise(r=>release=r);order.push('refresh-end');return json({refreshed:true})}return json(status)},null,{locks});
    const b=ui(async(url)=>{if(url.endsWith('auth-signout')){order.push('logout');return json({signedOut:true,remoteRevoked:true,message:'Signed out'})}return json(status)},null,{locks});await a.settle();await b.settle();a.d.getElementById('account-refresh').click();await reached;b.d.getElementById('account-recovery-signout').click();await b.settle();assert.deepEqual(order,['refresh-start']);release();await a.settle();await b.settle();assert.deepEqual(order,['refresh-start','refresh-end','logout']);a.close();b.close();
  });
  await test('Without Web Locks refresh is disabled, while explicit browser-session removal remains available',async()=>{
    const status={...signedout,sessionState:'needs-refresh',refreshAvailable:true};let removed=false;
    const u=ui(async(url)=>url.endsWith('auth-signout')?(removed=true,json({signedOut:true,remoteRevoked:false,message:'Browser removed; provider revocation is unconfirmed.'})):json(removed?signedout:status),null,{locks:false});await u.settle();assert.equal(u.d.getElementById('account-refresh').disabled,true);assert.match(u.d.getElementById('account-recovery-note').textContent,/refresh is disabled/);u.d.getElementById('account-refresh').click();await u.settle();assert.equal(u.requests.some(r=>r.url.endsWith('auth-refresh')),false);u.d.getElementById('account-recovery-signout').click();await u.settle();assert.equal(removed,true);assert.equal(u.d.getElementById('account-entry-panel').hidden,false);assert.match(u.d.getElementById('account-status').textContent,/revocation is unconfirmed/);u.close();
  });
  await test('BroadcastChannel carries only account-change notification and triggers a fresh status check',async()=>{
    const channels=[];class Channel{constructor(){channels.push(this)}postMessage(data){assert.equal(JSON.stringify(data),'{"type":"account-changed"}');for(const peer of channels)if(peer!==this)queueMicrotask(()=>peer.onmessage&&peer.onmessage({data}))}}
    let ended=false;const respond=async(url)=>url.endsWith('auth-signout')?(ended=true,json({signedOut:true,remoteRevoked:true,message:'Signed out'})):json(ended?signedout:{...signedout,authenticated:true,sessionState:'verified',user:{id:user.id,email:user.email,provider:'google'}});
    const a=ui(respond,null,{channel:Channel}),b=ui(respond,null,{channel:Channel});await a.settle();await b.settle();assert.equal(b.d.getElementById('account-signed-in').hidden,false);a.d.getElementById('account-signout').click();await a.settle();await b.settle();assert.equal(b.d.getElementById('account-signed-in').hidden,true);assert.equal(b.requests.filter(r=>r.url.endsWith('auth-status')).length,2);a.close();b.close();
  });
  const output={suite:'account-auth',passed:results.length,tests:results,scope:'Offline synthetic GoTrue REST and actual account HTML. No provider, email, deployment, real-user or native sign-in was exercised.'};
  const at=process.argv.indexOf('--output');if(at>=0)fs.writeFileSync(process.argv[at+1],JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output));
})().catch(error=>{console.error(error);process.exitCode=1});
