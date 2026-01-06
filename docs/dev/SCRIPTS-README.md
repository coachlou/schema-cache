# Database Seeding Scripts

Scripts to populate your Supabase database with sample data for testing the schema-loader.

## Prerequisites

You'll need your Supabase **Service Role Key** (not the anon key). You can find this in:
- Supabase Dashboard → Project Settings → API → `service_role` key

⚠️ **Warning:** The service role key bypasses RLS. Keep it secret!

## Option 1: TypeScript/Deno (Recommended)

```bash
# Set your service role key
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"

# Run the script
deno run --allow-net --allow-env scripts/seed-data.ts
```

This will:
1. Create a test client with domain `example.com`
2. Generate an API key for that client
3. Add 4 sample schemas (homepage, services, about, contact)
4. Print the client ID and API key you can use for testing

## Option 2: Bash Script

```bash
./scripts/seed-data.sh uxkudwzbqijamqhuowly your-service-role-key-here
```

## What Gets Created

### 1. Client Record
- **Name:** Test Client
- **Domain:** example.com
- **API Key:** Auto-generated (you'll see this in output)

### 2. Sample Schemas

| Page URL | Schema Type | Description |
|----------|-------------|-------------|
| `https://example.com/` | WebPage | Homepage |
| `https://example.com/services/` | Service | Services page |
| `https://example.com/about/` | AboutPage | About page |
| `https://example.com/contact/` | ContactPage | Contact page |

## After Running

The script will output commands you can use to test:

```bash
# Test the schema loader (returns JavaScript)
curl 'https://[project].supabase.co/functions/v1/schema-loader?client_id=[uuid]'

# Fetch a specific schema (returns JSON-LD)
curl 'https://[project].supabase.co/functions/v1/get-schema?client_id=[uuid]&url=https://example.com/services/'
```

## Adding Your Own Data

### Via API (Recommended)

Use the `update-schema` function with the API key from the client record:

```bash
curl -X POST 'https://[project].supabase.co/functions/v1/update-schema' \
  -H "X-API-Key: [client-api-key]" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "[client-uuid]",
    "page_url": "https://yoursite.com/page/",
    "schema_json": {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": "Your Article Title"
    }
  }'
```

### Direct Database Insert

You can also insert directly via the Supabase REST API or SQL editor:

```sql
-- Insert a client
INSERT INTO clients (name, domain)
VALUES ('My Company', 'mycompany.com')
RETURNING id, api_key;

-- Insert a schema (use the client id from above)
INSERT INTO page_schemas (client_id, page_url, schema_json)
VALUES (
  'client-uuid-here',
  'https://mycompany.com/products/',
  '{"@context": "https://schema.org", "@type": "Product", "name": "Widget"}'::jsonb
);
```

## Testing Your Integration

1. Update [test.html](../test.html) with your client ID
2. Open it in a browser
3. Check the browser console for schema injection logs
4. View page source to see the injected JSON-LD

## Troubleshooting

### "Failed to create client"
- Check that your service role key is correct
- Verify the project ref matches your Supabase project
- Ensure migrations have been applied (`supabase db push`)

### "Failed to add schema"
- The client must exist first
- Check that the API key matches the client
- Verify the `update-schema` function is deployed

### Schema not appearing
- Check URL normalization (trailing slashes are stripped)
- Verify client_id is correct
- Check browser console for errors
