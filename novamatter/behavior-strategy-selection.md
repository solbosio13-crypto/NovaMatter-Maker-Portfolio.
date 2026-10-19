# Evidence-guided behavior strategy selection

**Original module:** `NovaLife/supabase/functions/novamatter-behavior-filter/index.ts`  
**Original lines:** 60–89

This is a bounded ranking function used by the shared intelligence layer. It combines a baseline strategy weight with opt-in aggregate feedback *only after* the minimum sample count is met, then gives a small boost to strategies linked with the supplied public research topics.

The implementation is **rule-based**. It does not train a user-specific psychological model, and the excerpt below depends on backend services intentionally omitted from this public repository.

```ts
async function selectStrategies(domain:string,evidenceTopics:string[]) {
  const [strategies,stats]=await Promise.all([
    admin('/rest/v1/novalife_behavior_strategies?active=eq.true&domains=cs.{'+encodeURIComponent(domain)+'}&select=strategy_key,display_name,description,topic_keys,base_weight,minimum_feedback_samples,guardrails'),
    admin('/rest/v1/novalife_behavior_strategy_stats?domain=eq.'+encodeURIComponent(domain)+'&select=strategy_key,signal_count,posterior_helpfulness').catch(()=>[])
  ]);
  const statsMap=new Map<string,any>();
  for(const row of Array.isArray(stats)?stats:[]) statsMap.set(String(row.strategy_key),row);
  const evidenceSet=new Set(evidenceTopics);
  const ranked=(Array.isArray(strategies)?strategies:[]).map((row:any)=>{
    const base=Math.max(0,Math.min(1,Number(row.base_weight??0.5)));
    const stat=statsMap.get(String(row.strategy_key));
    const count=Number(stat?.signal_count??0);
    const min=Number(row.minimum_feedback_samples??20);
    const posterior=Math.max(0,Math.min(1,Number(stat?.posterior_helpfulness??base)));
    const learned=count>=min ? 0.8*base+0.2*posterior : base;
    const topics=Array.isArray(row.topic_keys)?row.topic_keys.map(String):[];
    const evidenceMatch=topics.some((topic:string)=>evidenceSet.has(topic));
    return {...row,signalCount:count,score:learned+(evidenceMatch?0.08:0),evidenceMatch};
  }).sort((a:any,b:any)=>b.score-a.score).slice(0,5);

  return ranked.map((row:any)=>({
    strategy_key:String(row.strategy_key),
    display_name:clean(row.display_name,120),
    description:clean(row.description,500),
    evidence_match:Boolean(row.evidenceMatch),
    signal_count:Number(row.signalCount??0),
    feedback_tuning_active:Number(row.signalCount??0)>=Number(row.minimum_feedback_samples??20),
    guardrails:row.guardrails??{}
  }));
}
```

The input to this filter contains a domain and public evidence-topic keys, not raw personal chats. Safety rules remain separate from ranking.
