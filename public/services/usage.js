// A clock of foreground interaction, not of the local Node process.
export class ActivityClock{
 constructor(now,{idle=600000,maxGap=30000,active=true}={}){this.last=now;this.activityAt=now;this.idle=idle;this.maxGap=maxGap;this.active=active;}
 advance(now){const elapsed=this.active?Math.max(0,Math.min(now,this.activityAt+this.idle,this.last+this.maxGap)-this.last):0;this.last=now;return elapsed;}
 activity(now){let elapsed=0;if(now>this.activityAt+this.idle)elapsed=this.advance(now);this.activityAt=now;return elapsed;}
 setActive(now,active){const elapsed=this.advance(now);this.active=active;if(active)this.activityAt=now;return elapsed;}
}
let clock,session,visit=null,samples=[],visits=[],queue=Promise.resolve(),lastActivity=0,initialized=false,hasSentSession=false;
const active=()=>document.visibilityState==='visible'&&document.hasFocus();
function collect(ms){if(ms<=0)return;const end=Date.now();samples.push({id:crypto.randomUUID(),visit_id:visit?.id||null,start_ms:end-ms,end_ms:end});}
function send(ended=false){if(!initialized||hasSentSession&&!samples.length&&!visits.length&&!ended)return queue;const data={session_id:session,visits:visits.slice(),samples:samples.slice(-64),ended};samples=[];queue=queue.catch(()=>{}).then(async()=>{try{const r=await fetch('/api/usage/heartbeat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),keepalive:true});if(!r.ok)throw Error('usage unavailable');hasSentSession=true;const ids=new Set(data.visits.map(v=>v.id));visits=visits.filter(v=>!ids.has(v.id));}catch{samples=[...data.samples.filter(s=>s.end_ms>Date.now()-120000),...samples].slice(-64);}});return queue;}
export const usageTracker={
 initialize(){if(initialized)return;initialized=true;session=crypto.randomUUID();clock=new ActivityClock(performance.now(),{active:active()});send();setInterval(()=>{collect(clock.advance(performance.now()));send();},15000);
  const activity=()=>{const t=performance.now();if(t-lastActivity<1000)return;lastActivity=t;collect(clock.activity(t));};for(const name of ['pointerdown','pointermove','keydown','wheel','touchstart','input'])window.addEventListener(name,activity,{passive:true});
  const visibility=()=>{collect(clock.setActive(performance.now(),active()));send();};document.addEventListener('visibilitychange',visibility);window.addEventListener('focus',visibility);window.addEventListener('blur',visibility);window.addEventListener('pagehide',()=>{collect(clock.setActive(performance.now(),false));send(true);});window.addEventListener('pageshow',()=>{collect(clock.setActive(performance.now(),active()));send();});
 },
 route(project_id){if(!initialized||visit?.project_id===project_id||!visit&&!project_id)return;collect(clock.advance(performance.now()));visit=project_id?{id:crypto.randomUUID(),project_id}:null;if(visit)visits.push(visit);send();},
 flush(){if(initialized){collect(clock.advance(performance.now()));return send();}return queue;},
 ready(){return queue;}
};
