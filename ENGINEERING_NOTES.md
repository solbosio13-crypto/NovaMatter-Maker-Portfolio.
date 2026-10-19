# Engineering Notes

This is a code-focused companion to the Maker Portfolio.

## System overview

```text
NovaLens app --------------------> NovaLens server/API ---+
                                                         |
                                                         +--> NovaMatter gateway
                                                         |     - request scope and policy
NovaLife app --------------------> NovaLife server/API ---+     - sensitive-content handling
                                                               - shared public evidence
                                                               - research provenance
                                                               - freshness/uncertainty rules
```

The mobile apps are client interfaces. Policy enforcement and shared research are designed to run in backend services. A product-specific user's private conversation is not an input to the general shared-research endpoint.

## What is original in the engineering approach

- The water-evidence resolver distinguishes a **measurement** from a **category estimate** and declines to rank products when functional units conflict or sources disagree.
- Carbon accounting distinguishes **CO2** from **CO2e** and preserves unknowns when attributable factors are unavailable.
- Research corroboration validates cited links against the URLs observed in a web search before it accepts a signal; corroboration strength caps reported confidence.
- General wellbeing strategies are ranked using evidence-topic matches and a bounded aggregate-feedback adjustment. The minimum-sample gate is deliberate.
- The research ingest process preserves study type and provenance, rather than elevating research titles to verified findings.
- User communication settings are adapted from explicit language and formatting cues, rather than invented clinical inferences.

## Disclosure and scope

Only source demonstrations suitable for public review are included. Production credentials, private data, full backend configurations, private scoring formulas, and customer records remain outside this repository. Source excerpts are labeled as excerpts.

Public access to these files permits inspection; it does not include a software license permitting redistribution or commercial reuse.
