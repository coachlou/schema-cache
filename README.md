# Schema Cache - AI Discovery Enhancement

A lightweight JSON-LD schema injection service that helps AI engines (ChatGPT, Claude, Perplexity, Gemini) better understand and cite your website content.

## What It Does

This service automatically injects structured JSON-LD schema markup into your web pages, improving how AI engines:
- **Cite you as an authority** in relevant searches
- **Recommend your services** with confidence
- **Build knowledge graphs** connecting you to related topics
- **Extract accurate information** about your expertise and offerings

## Quick Start

### 1. Get Your Organization ID

Contact the schema-cache administrator to set up your organization and receive your unique `client_id`.

### 2. Add the Script Tag

Add this single line to the `<head>` section of your website:

```html
<script src="https://schema.coachlou.com/functions/v1/schema-loader?client_id=YOUR_CLIENT_ID"></script>
```

**That's it!** The script will automatically:
- Detect the current page URL
- Fetch the pre-cached JSON-LD schema for that page
- Inject it into your page's `<head>` as `<script type="application/ld+json">`
- Send drift detection signals if page content changes

### 3. Verify It's Working

After adding the script tag, view your page source (right-click → View Page Source). You should see a `<script type="application/ld+json">` tag in the `<head>` containing your structured data.

## How the Script Tag Works

When a visitor loads your page:

1. **Automatic Detection**: The script detects the current page URL
2. **Schema Retrieval**: It fetches the cached JSON-LD schema from the edge-cached API
3. **Silent Injection**: The schema is injected into the page's `<head>` section
4. **Fail-Safe**: If anything goes wrong, the script fails silently and never breaks your page
5. **Drift Detection**: Content hash is sent to detect when pages change

### What Gets Injected

Example of what gets added to your `<head>`:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Person",
      "name": "Amy Yamada",
      "jobTitle": "AI Business Coach",
      "description": "Expert in AI implementation...",
      "knowsAbout": ["Artificial Intelligence", "Business Coaching", "Leadership"]
    },
    {
      "@type": "Service",
      "name": "AI Power Leap VIP Day",
      "serviceType": "AI Implementation Coaching",
      "provider": { "@id": "#person" }
    }
  ]
}
</script>
```

## Real-World Example: Amy Yamada

**Organization ID**: `21c3dc7d-bf61-4f00-b2b5-945d98807cbf`

**Implementation**:
```html
<script src="https://schema.coachlou.com/functions/v1/schema-loader?client_id=21c3dc7d-bf61-4f00-b2b5-945d98807cbf"></script>
```

**Pages Cached**: 15 pages across amyyamada.com including homepage, services, courses, and contact pages.

**Result**: AI engines can now confidently cite Amy as "AI Business Coach and founder of PowerhouseAI, who specializes in done-with-you AI implementation through VIP days and courses."

## Performance

- **Edge-Cached**: Schemas served from Cloudflare's global CDN
- **Fast**: ~200-400ms response time (p90)
- **Lightweight**: ~2-5KB per schema injection
- **Non-Blocking**: Async loading never delays page render

## Security & Privacy

- ✅ **Read-Only**: The script only reads schemas, never modifies your site
- ✅ **Fail-Safe**: Errors fail silently and never break your page
- ✅ **No Tracking**: No user data collected or tracked
- ✅ **Public Data**: Only publicly cacheable schemas are served
- ✅ **CORS-Enabled**: Works across all domains

## Updating Your Schemas

Schemas are managed by the schema-cache administrator. To update a page's schema:

1. Contact the administrator with the page URL and updated schema
2. Administrator updates via the Admin API
3. Cache automatically invalidates
4. New schema appears on your site within minutes

## Support

For questions, schema updates, or issues:
- **GitHub Issues**: https://github.com/coachlou/schema-cache/issues
- **Documentation**: See [docs/dev/CLAUDE.md](docs/dev/CLAUDE.md) for technical details

## Technical Details

For developers and administrators, see:
- [docs/dev/CLAUDE.md](docs/dev/CLAUDE.md) - Development guide
- [docs/dev/GEARS-DB-SCHEMA.md](docs/dev/GEARS-DB-SCHEMA.md) - Database schema
- [docs/dev/SUPABASE-SCHEMA-SPEC.md](docs/dev/SUPABASE-SCHEMA-SPEC.md) - GEARS integration spec
