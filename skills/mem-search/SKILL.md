# <span data-proof="authored" data-by="ai:claude">Memory Search</span>

<span data-proof="authored" data-by="ai:claude">Search your project memory using the 3-layer progressive pattern.</span>

## <span data-proof="authored" data-by="ai:claude">Workflow</span>

<span data-proof="authored" data-by="ai:claude">Always follow this pattern for token-efficient memory retrieval:</span>

### <span data-proof="authored" data-by="ai:claude">Layer 1: Search Index</span>

```
search(q="your query", project="project-name", limit=20)
```

<span data-proof="authored" data-by="ai:claude">Returns IDs, titles, and dates. ~50-100 tokens per result.</span>

### <span data-proof="authored" data-by="ai:claude">Layer 2: Timeline Context</span>

```
timeline(project="project-name", limit=50)
```

<span data-proof="authored" data-by="ai:claude">Returns chronological context showing what was happening around results.</span>

### <span data-proof="authored" data-by="ai:claude">Layer 3: Full Details</span>

```
get_observations(ids=[1, 2, 3])
```

<span data-proof="authored" data-by="ai:claude">Fetch complete observation details. ~500-1000 tokens per result.
Only fetch IDs you've already filtered from Layer 1/2.</span>

## <span data-proof="authored" data-by="ai:claude">Rules</span>

* <span data-proof="authored" data-by="ai:claude">NEVER skip to Layer 3 without filtering first</span>

* <span data-proof="authored" data-by="ai:claude">Always batch multiple IDs in a single</span> <span data-proof="authored" data-by="ai:claude">`get_observations`</span> <span data-proof="authored" data-by="ai:claude">call</span>

* <span data-proof="authored" data-by="ai:claude">Use</span> <span data-proof="authored" data-by="ai:claude">`project`</span> <span data-proof="authored" data-by="ai:claude">parameter to scope searches when working in a specific project</span>

* <span data-proof="authored" data-by="ai:claude">10x token savings compared to fetching everything upfront</span>