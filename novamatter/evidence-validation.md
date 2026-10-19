# Evidence integrity: selected source examples

The following excerpts come from the **NovaLens** backend's research validation and world-analysis services. They are not complete executable services. Database access and privileged policy settings are intentionally omitted.

## Registered-source eligibility and matching

**Original module:** `NovaLens-Mobile/supabase/migrations/20261001010000_release_gate_research_search_hardening.sql`, lines 231–261

The code verifies source-domain alignment and required eligibility conditions before admitting evidence as score-relevant.

```sql
    v_host_ok :=
      v_proposal_host is not null
      and (
        (
          v_canonical_host is not null
          and (
            v_proposal_host = v_canonical_host
            or v_proposal_host like '%.' || v_canonical_host
            or v_canonical_host like '%.' || v_proposal_host
          )
        )
        or (
          v_api_host is not null
          and (
            v_proposal_host = v_api_host
            or v_proposal_host like '%.' || v_api_host
            or v_api_host like '%.' || v_proposal_host
          )
        )
      );

    if v_entity_for_row is null
       or r.source_registry_id is null
       or r.metric_id is null
       or coalesce(r.source_active,false) is not true
       or r.admission_status <> 'approved'
       or r.evidence_use <> 'direct'
       or r.source_tier <> 'A'
       or coalesce(r.score_eligible,false) is not true
       or coalesce(r.metric_active,false) is not true
       or coalesce(v_host_ok,false) is not true then
```

## Live-search corroboration and confidence limits

**Original module:** `NovaLens-Mobile/supabase/functions/nova-world-analysis/index.ts`, lines 325–339

Cited URLs must appear in the search trace; independent-domain corroboration caps confidence.

```ts
  const webUrls=extractWebUrls(payload);
  const seen=new Set(webUrls.map(normalizeUrl).filter(Boolean));
  const validatedSignals:any[]=[];
  const allEvidence=new Map<string,any>();

  for(const s of Array.isArray(result.signals)?result.signals:[]){
    const requested=asStringArray(s.source_urls,8,1500).map(normalizeUrl).filter(Boolean);
    const accepted=requested.filter(u=>seen.has(u));
    if(!accepted.length)continue;
    const evidence=accepted.map(u=>sourceDescriptor(u,registry));
    for(const ev of evidence)allEvidence.set(ev.url,ev);
    const domains=[...new Set(evidence.map((e:any)=>e.domain).filter(Boolean))];
    const hasStrong=evidence.some((e:any)=>e.registeredDirect||e.officialPrimary);
    const corroborationCap=domains.length>=3?(hasStrong?0.96:0.88):domains.length===2?(hasStrong?0.88:0.78):(hasStrong?0.65:0.52);
    const evidenceConfidence=Math.min(clamp01(s.confidence),corroborationCap);
```

## Evidence-factor emissions calculation

**Original module:** `NovaLens-Mobile/supabase/functions/nova-carbon/index.ts`, lines 722–743

The calculation converts activity units before multiplying by an eligible emissions factor, and keeps carbon dioxide (CO2) separate from carbon dioxide equivalent (CO2e).

```ts
      if (factor?.available === true) {
        const converted = convertActivity(value, inputUnit, factor.activityUnit);
        if (converted !== null) {
          const kg = converted * Number(factor.kgPerActivityUnit);
          quantified = true;
          impactStatus = 'verified';
          confidence = factor.confidencePct ?? null;
          documentIds = factor.documentId ? [factor.documentId] : [];
          reason = null;
          impactDelta = {
            activity_value: value,
            activity_unit: inputUnit,
            normalized_activity_value: converted,
            normalized_activity_unit: factor.activityUnit,
            factor_value: factor.factorValue,
            factor_unit: factor.factorUnit,
            factor_kg_per_activity_unit: factor.kgPerActivityUnit,
            emissions_basis: factor.basis,
            co2e_kg: factor.basis === 'CO2e' ? Number(kg.toFixed(6)) : null,
            co2_kg: factor.basis === 'CO2' ? Number(kg.toFixed(6)) : null,
            methodology: 'evidence_factor_times_user_activity_v1',
          };
```
