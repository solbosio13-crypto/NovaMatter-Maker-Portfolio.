# NovaMatter | Selected Engineering Portfolio

**Presented by Sol Bosio**  
**Projects:** NovaMatter, NovaLens, NovaLife

NovaMatter is an evidence-oriented software ecosystem encompassing two consumer applications: **NovaLens**, which explores product and financial decisions alongside environmental impact, and **NovaLife**, which provides personalized planning and wellbeing support. The shared NovaMatter layer coordinates research and data-protection policies across these products.

This repository contains **curated, nonconfidential source code** selected to demonstrate the underlying engineering. The application repositories and production services are not published here. These are implementation examples, not a standalone deployable app or a claim of independent model training.

## Quick code tour

| Area | Explore | What the code demonstrates |
| --- | --- | --- |
| Shared gateway privacy | [Data classification and audit](novamatter/security-and-privacy-gateway.md) | Block/redact/minimize decisions and hashed audit metadata |
| Cross-app research policy | [Gateway routing](novamatter/shared-intelligence-routing.md) | Product scopes, versioned policy, and sanitization before research |
| Evidence-aware environmental analysis | [Water evidence resolver](novalens/src/lib/water.ts) | Source precedence, unit compatibility, contradictions, and explicit unknowns |
| Verification tests | [Water evidence tests](novalens/src/lib/__tests__/water.test.ts) | Tests for the water-analysis evidence rules |
| Quantitative decision tools | [Financial models](novalens/src/lib/advanced-finance.ts) | IRR root-finding, NPV, depreciation, and amortization |
| Statistical computation | [Analytics](novalens/src/lib/analytics.ts) | Regression, dispersion, robust statistics, and drawdown analysis |
| Carbon uncertainty handling | [Carbon confidence](novalens/src/lib/carbonConfidence.ts) | Validation and presentation of measured confidence ranges |
| Privacy-aware local persistence | [Encrypted device vault](novalens/src/lib/vault.ts) | Encryption and platform-specific local key storage |
| Adaptive communication | [Personalization](novalife/lib/personalization.ts) | Interpretable responses to observable writing preferences |
| Repetition heuristics | [Rumination detection](novalife/lib/rumination.ts) | Comparing similarity across recent conversational messages |
| Evidence-guided behavior selection | [Strategy ranking](novamatter/behavior-strategy-selection.md) | Bounded use of aggregated feedback and relevant research topics |
| Statistical feedback layer | [Feedback view](novamatter/behavior-feedback-stats.sql) | Smoothed aggregate helpfulness rather than relying on small samples |
| Scientific evidence processing | [Research indexing](novamatter/research-evidence-indexing.md) | Publication types, provenance, retraction checks, and content hashing |
| Research corroboration | [Evidence policies](novamatter/evidence-validation.md) | Source eligibility, domain matching, and search-source corroboration |

## Engineering focus

**Evidence before conclusions.** Unknown, contradictory, incomparable, or insufficiently sourced measurements remain uncertain. The product is designed not to turn absence of data into a measured zero.

**Traceable research.** The research pipeline records publication identifiers, source metadata, evidence classes, and retrieval information so findings can be reviewed in context.

**Bounded adaptation.** NovaLife uses rule-based communication adaptation and evidence-informed strategy selection. Aggregate opt-in helpfulness can affect the priority of a general strategy after a minimum sample threshold, but it does not replace safety rules or constitute a trained clinical model.

**Sensitive data boundaries.** Public research context is separated from user-specific application context. The selected local vault demonstrates encrypted on-device handling of sensitive records.

## Reading these files

The `novalens/` and `novalife/` directories preserve source-relative paths for traceability. Some files depend on types, services, packages, or UI code that is intentionally absent from this public selection. The `novamatter/` documents contain explicitly labeled source excerpts from backend operations, not runnable copies of those services.

These examples demonstrate implementation choices; they do **not**, by themselves, establish production scale, performance, or a security certification. For a short narrative overview, see [Engineering Notes](ENGINEERING_NOTES.md).

## Portfolio demonstrations

The Maker Portfolio contains an approximately 117-second combined NovaLens and NovaLife iPhone demonstration and selected source-code screenshots, submitted separately through MIT SlideRoom. Those media provide observed UI context for the code showcased here.
