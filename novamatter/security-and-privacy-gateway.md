# NovaMatter security and privacy gateway

**Original implementation:** `NovaLens-Mobile/supabase/functions/nova-intelligence-gateway/index.ts`

This document shows selected, reviewable **source excerpts** from the backend gateway. The original service remains private; these fragments are not a runnable gateway or proof that a deployed build has passed an independent security audit.

## Request classification and minimization

The gateway assigns a data classification and an action such as allow, redact, minimize, or block. It rejects recognized secret-bearing inputs and trims identifiers before invoking selected research services.

```ts
function shieldText(value:unknown, appScope:'novalens'|'novalife'):Shield {
  let text = String(value ?? '').replace(/\u0000/g,'').slice(0,12000);
  const flags:string[] = [];
  let classification:Shield['classification'] = 'PUBLIC';
  let action:Shield['action'] = 'allow';
  let redactionCount = 0;
```

### Block and redaction paths

```ts
  if (containsPaymentCard(text)) flags.push('payment_card');
  if (flags.length) {
    return {classification:'SECRET',action:'block',flags,redactionCount:0,sanitized:''};
  }

  const redactions = [
    {name:'email', re:/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement:'[email removed]'},
    {name:'phone', re:/\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g, replacement:'[phone removed]'},
  ];
  for (const rule of redactions) {
    const matches = text.match(rule.re);
    if (matches?.length) {
      flags.push(rule.name);
      redactionCount += matches.length;
      text = text.replace(rule.re,rule.replacement);
    }
  }
  if (redactionCount) {
    classification='USER_PRIVATE';
    action='redact';
  }

  if (appScope === 'novalife' && /\b(?:diagnos(?:is|ed)|medication|prescription|therapy|therapist|self[- ]harm|suicid|eating disorder|binge|purge)\b/i.test(text)) {
    classification='SENSITIVE_WELLBEING';
    if (action === 'allow') action='minimize';
    flags.push('sensitive_wellbeing_context');
  }

  if (/(?:ignore|override|disregard)\s+(?:all\s+)?(?:previous|system|developer)\s+(?:instructions|rules)|reveal\s+(?:your\s+)?(?:system prompt|secrets?)/i.test(text)) {
    flags.push('prompt_injection_pattern');
  }

  return {classification,action,flags:[...new Set(flags)],redactionCount,sanitized:text.trim()};
```

## Audit trail without raw query text

The gateway writes an event describing the decision and detector flags, using a request hash instead of the raw content.

```ts
async function shieldAudit(appScope:string, shield:Shield, requestHash:string, metadata:Record<string,unknown>={}) {
  try {
    await admin('/rest/v1/novamatter_data_shield_events',{
      method:'POST',
      headers:{Prefer:'return=minimal'},
      body:JSON.stringify({
        app_scope:appScope,
        actor_kind:'edge_gateway',
        classification:shield.classification,
        action:shield.action,
        detector_flags:shield.flags,
        request_hash:requestHash,
        redaction_count:shield.redactionCount,
        quarantine_reason:shield.action==='quarantine'||shield.action==='block' ? shield.flags.join(',')||'policy_block' : null,
        metadata,
      }),
    });
  } catch (error) {
    console.error('shield_audit_failed',error);
  }
}
```

These are **defense-in-depth mechanisms**, not a claim of complete personal-data detection or independent certification.
