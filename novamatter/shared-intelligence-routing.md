# NovaMatter shared intelligence and cross-application routing

**Original implementation:** `NovaLens-Mobile/supabase/functions/nova-intelligence-gateway/index.ts`

NovaMatter is a policy and public-evidence service used by NovaLens and NovaLife. These selected code paths illustrate the product boundary.

## Public evidence: scoped requests, versioned policy, audit metadata

```ts
    if (op==='public_evidence') {
      const appScope = String((body as any).app_scope ?? 'novalife');
      const domain = String((body as any).domain ?? '').toLowerCase();
      if (!APP_SCOPES.has(appScope) || !DOMAINS.has(domain)) return json({error:'invalid_scope_or_domain'},400);
      const policyKey = appScope==='novalife' ? 'novalife.'+domain : 'shared.public-evidence';
      const activePolicy = await policy(policyKey);
      if (!activePolicy) return json({error:'active_policy_missing'},503);
      const started=Date.now();
      const requestHash=await sha256(appScope+'|public_evidence|'+domain);
      const run=await agentRun({
        app_scope:appScope,domain,agent_key:'shared-intelligence',operation:'public_evidence',
        policy_key:activePolicy.policy_key,policy_version:activePolicy.version,request_hash:requestHash,
        data_class:'PUBLIC',redaction_count:0,source_policy_version:'shared-evidence-hierarchy-v1',
        status:'started',metadata:{user_specific:false,personal_content_forwarded:false},
      });
      const result=await invokeFunction('nova-shared-intelligence',{op:'domain_digest',domain},null,10_000);
      EdgeRuntime.waitUntil(refreshPsychologyEvidenceInBackground());
      await finishRun(run?.id??null,result.ok?'completed':'failed',Date.now()-started,{upstream_status:result.status,backgroundPsychologyRefresh:true});
      if (!result.ok) return json({error:'shared_intelligence_unavailable'},503);
      return json({...result.data,gateway:{version:VERSION,policyKey:activePolicy.policy_key,policyVersion:activePolicy.version,personalContentForwarded:false}});
```

This path accepts a product scope and research domain. It does not forward a personal chat message or journal to the general public-evidence service.

## NovaLens research: authentication, sanitization, and policy binding

```ts
    if (op==='novalens_research') {
      const user=await currentUser(req);
      if (!user) return json({error:'authentication_required'},401);
      const rawQuery=String((body as any).query ?? '').trim().slice(0,8000);
      if (!rawQuery) return json({error:'query_required'},400);
      const activePolicy=await policy('novalens.research');
      if (!activePolicy) return json({error:'active_policy_missing'},503);
      const shield=shieldText(rawQuery,'novalens');
      const requestHash=await sha256(rawQuery);
      await shieldAudit('novalens',shield,requestHash,{operation:'research',raw_content_stored:false});
      if (shield.action==='block' || !shield.sanitized) {
        return json({error:'sensitive_data_blocked',message:'Remove passwords, secret keys, payment-card numbers, or government identifiers before asking Nova to research a purchase.',flags:shield.flags},400);
      }
      const started=Date.now();
      const run=await agentRun({
        app_scope:'novalens',domain:'commerce',agent_key:'nova-live-industry-agent',operation:'research',
        policy_key:activePolicy.policy_key,policy_version:activePolicy.version,user_id:user.id,request_hash:requestHash,
        data_class:shield.classification,redaction_count:shield.redactionCount,source_policy_version:'nova-research-policy',
        status:'started',metadata:{detector_flags:shield.flags,raw_query_stored:false,sanitized_forwarded:shield.redactionCount>0},
      });
      const auth=req.headers.get('authorization');
      const params=(body as any).params && typeof (body as any).params==='object' ? (body as any).params : {};
      const result=await invokeFunction('nova-live-industry-agent',{...params,query:shield.sanitized},auth,95_000);
      await finishRun(run?.id??null,result.ok?'completed':'failed',Date.now()-started,{upstream_status:result.status});
      if (!result.ok) return json(result.data,result.status||502);
      return json({...result.data,gateway:{version:VERSION,policyKey:activePolicy.policy_key,policyVersion:activePolicy.version,dataClass:shield.classification,redactions:shield.redactionCount,flags:shield.flags}});
```

The research route checks an active policy and classifies/sanitizes the query before forwarding it. It separately records execution status and policy version without saving the raw query as an audit string.

## Scope of this selection

Only nonconfidential portions are published. Production environment variables, service keys, live user data, and full privileged backend infrastructure are excluded. The text illustrates implemented control flow, not independently verified runtime guarantees.
