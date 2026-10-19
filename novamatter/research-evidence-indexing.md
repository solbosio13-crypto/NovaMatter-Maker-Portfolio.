# Scientific research provenance and indexing

**Original module:** `NovaLife/supabase/functions/nova-psychology-research-refresh/index.ts`

The shared research refresh workflow queries PubMed-indexed studies and builds a structured record of publication type, journal, DOI/PMID, retraction flag, date, and excerpts. It does not treat a title alone as an established scientific finding.

### Publication-type classification (original lines 66–75)

```ts
function evidenceClass(pubtypes: string[]) {
  const joined = pubtypes.join(' ').toLowerCase();
  if (joined.includes('meta-analysis')) return 'meta_analysis';
  if (joined.includes('systematic review')) return 'systematic_review';
  if (joined.includes('randomized controlled trial')) return 'randomized_controlled_trial';
  if (joined.includes('practice guideline') || joined.includes('guideline')) return 'guideline';
  if (joined.includes('review')) return 'review';
  if (joined.includes('observational') || joined.includes('cohort') || joined.includes('case-control')) return 'observational';
  return 'other';
}
```

### Provenance and content hashing (original lines 160–185)

```ts
    const doi = ids.doi || null;
    const publicationDate = parseDate(row?.epubdate || row?.pubdate);
    const retracted = pubtypes.some((x: string) => /retracted publication|retraction of publication/i.test(x));
    const canonical = 'https://pubmed.ncbi.nlm.nih.gov/' + pmid + '/';
    const excerpt = excerpts[pmid] ?? { abstract_excerpt:null, conclusion_excerpt:null, abstract_available:false };
    const hash = await sha256(JSON.stringify({ pmid, doi, title, journal: row?.fulljournalname || row?.source, publicationDate, pubtypes, authors, retracted }));
    const paper = {
      source_database: 'pubmed',
      source_record_id: pmid,
      pmid,
      doi,
      title,
      journal: clean(row?.fulljournalname || row?.source, 500) || null,
      publication_date: publicationDate,
      publication_types: pubtypes,
      authors,
      evidence_class: evidenceClass(pubtypes),
      topic_keys: [topicKey],
      source_url: canonical,
      pmc_url: pmc ? 'https://pmc.ncbi.nlm.nih.gov/articles/' + pmc + '/' : null,
      retracted,
      abstract_excerpt: excerpt.abstract_excerpt,
      conclusion_excerpt: excerpt.conclusion_excerpt,
      abstract_available: excerpt.abstract_available,
      content_hash: hash,
      metadata: { issn: clean(row?.issn,100)||null, volume:clean(row?.volume,80)||null, issue:clean(row?.issue,80)||null, pages:clean(row?.pages,80)||null, pubmed_record_only:true, full_text_not_copied:true },
```

The second excerpt is an object-construction segment inside an ingestion function; surrounding helpers and private backend storage are not reproduced here.
