# Firecrawl Lite Philosophy

## Question 1: Why so many docs?

**Linus would say**: "Write code, not documentation."

We've cleaned up. Here's what you actually need:

- **README.md** - Start here. 30 seconds to understand what it does
- **INTEGRATION_GUIDE.md** - If you're integrating it somewhere
- **src/** - The truth. Read the code
- **tests/** - Proof it works
- **git log** - The history

That's it. No process narratives. No verbose checklists. Code is the documentation.

---

## Question 2: Where should third-party integrations look?

**Answer**: Three places, in this order:

### 1. README.md
```markdown
## API
**POST /scrape** - Convert URL to Markdown
```
**Purpose**: Quick reference. "What does this thing do?"  
**Time**: 30 seconds

### 2. INTEGRATION_GUIDE.md
```markdown
## Quick Integration

### Node.js
import { scrape } from 'firecrawl-lite';
```
**Purpose**: "How do I use it?"  
**Time**: 5 minutes

### 3. src/server.ts
```typescript
app.post('/scrape', authenticate, async (req: Request, res: Response) => {
  try {
    const request = ScrapeRequestSchema.parse(req.body);
    const result = await scrape(request);
    res.json(result);
```
**Purpose**: "How does it work?"  
**Time**: When you need to debug or extend

**Never** send third-party developers to our internal verification docs. That's not their problem.

---

## Question 3: Should we add image downloading?

**Linus answer**: No. And here's why:

### The Unix Way
```
Tool A: Converts URL → Markdown
Tool B: Downloads images from URLs
Tool C: Stores files to disk
Tool D: Manages database records

Compose them. Don't mix concerns.
```

### Our Tool
```
Input:  URL
Output: Markdown
        ↓
        (let client handle the rest)
```

### If you need images:
```bash
# Option 1: Let client extract URLs
markdown = result.markdown
# Client parses markdown, finds links
# Client downloads them with: wget, curl, Python requests, etc.

# Option 2: Return URL list instead
{
  "markdown": "...",
  "images": ["url1", "url2", "url3"]
}

# Option 3: Use different tool
firecrawl-lite URL → markdown
wget image-list → download images
cat output → final result
```

### Why NOT add it here?

1. **Scope creep**: We're a URL→Markdown converter, not an image manager
2. **Complexity**: Image naming, dedup, storage, error handling
3. **Dependencies**: More code = more bugs = more maintenance
4. **Use cases differ**: 
   - Some want raw URLs
   - Some want base64 encoded
   - Some want uploaded to S3
   - Some want stored locally
   - Some don't want images at all

### Linus quote that applies:
> "It's often better to leave something alone than to add to it."

---

## Summary

| Question | Linus Answer |
|----------|--------------|
| Too many docs? | Delete them. Code is the doc. |
| Where to integrate? | README → INTEGRATION_GUIDE → source code |
| Add image download? | No. Do one thing well. |

**Result**: Firecrawl Lite = 933 lines, does one thing perfectly.

That's the way.
