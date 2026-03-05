# <span data-proof="authored" data-by="ai:claude">Smart Explore</span>

<span data-proof="authored" data-by="ai:claude">Navigate codebases efficiently using structural search tools.</span>

## <span data-proof="authored" data-by="ai:claude">Tools</span>

### <span data-proof="authored" data-by="ai:claude">smart_search</span>

<span data-proof="authored" data-by="ai:claude">Search for symbols, functions, classes across the codebase.</span>

```
smart_search(query="functionName", path="src/", max_results=20)
```

### <span data-proof="authored" data-by="ai:claude">smart_outline</span>

<span data-proof="authored" data-by="ai:claude">Get a structural outline of a file — all symbols with signatures, bodies folded.</span>

```
smart_outline(file_path="src/services/worker.ts")
```

<span data-proof="authored" data-by="ai:claude">Much cheaper than reading the full file.</span>

### <span data-proof="authored" data-by="ai:claude">smart_unfold</span>

<span data-proof="authored" data-by="ai:claude">Expand a specific symbol to see its full implementation.</span>

```
smart_unfold(file_path="src/services/worker.ts", symbol_name="startAgent")
```

## <span data-proof="authored" data-by="ai:claude">Pattern</span>

1. <span data-proof="authored" data-by="ai:claude">`smart_search`</span> <span data-proof="authored" data-by="ai:claude">to find relevant files/symbols</span>
2. <span data-proof="authored" data-by="ai:claude">`smart_outline`</span> <span data-proof="authored" data-by="ai:claude">to understand file structure</span>
3. <span data-proof="authored" data-by="ai:claude">`smart_unfold`</span> <span data-proof="authored" data-by="ai:claude">only for the specific symbols you need</span>