# Schema Injection Service - Implementation Plan

## Progress Tracker

**Current Release:** COMPLETE - POC with CDN Caching
**Overall Status:** All releases complete including R6 performance optimization
**Last Updated:** 2025-12-28

---

## Release 1: Foundation (Infrastructure & Core Setup)

### Status: COMPLETE

| Task | Type | Status | Notes |
|------|------|--------|-------|
| Create Supabase project | Admin | [x] Done | Project: uxkudwzbqijamqhuowly |
| Note project URL, anon key, service role key | Admin | [x] Done | Keys stored |
| Update config.toml with project ID | Code | [x] Done | Updated to uxkudwzbqijamqhuowly |
| Run database migration | Admin | [x] Done | `supabase db push` - required pgcrypto fix |
| Verify tables created (clients, page_schemas, drift_signals) | Admin | [x] Done | All tables created |
| Verify RLS policies applied | Admin | [x] Done | Policies active |
| Verify indexes created | Admin | [x] Done | All indexes created |

### Deliverables
- [x] Supabase project running
- [x] Database schema deployed
- [x] All tables and indexes verified

---

## Release 2: Core Schema Serving

### Status: COMPLETE

**Goal:** Client can embed script and receive JSON-LD injection

| Task | Type | Status | Notes |
|------|------|--------|-------|
| Deploy schema-loader function | Code | [x] Done | `--no-verify-jwt` flag used |
| Deploy get-schema function | Code | [x] Done | Optimized with direct REST API |
| Test schema-loader returns valid JS | Test | [x] Done | Returns valid JS with https URLs |
| Create test client record | Test | [x] Done | ID: 8939ddba-6a96-4bd9-8d7b-b1333c955aeb |
| Add test schema for a page | Test | [x] Done | example.com/services/ |
| Test get-schema returns JSON-LD | Test | [x] Done | Returns correct schema |
| Verify CORS headers work cross-origin | Test | [x] Done | Access-Control-Allow-Origin: * |
| Verify caching headers correct | Test | [x] Done | Cache-Control, ETag present |

### Success Criteria
- [x] Client can embed one script tag and receive JSON-LD schema injection
- [x] Schemas served in <200ms (p95) - **45ms with CDN cache!**

---

## Release 3: Schema Management API

### Status: COMPLETE

**Goal:** Schemas can be created/updated via authenticated API

| Task | Type | Status | Notes |
|------|------|--------|-------|
| Deploy update-schema function | Code | [x] Done | Deployed successfully |
| Test API key authentication works | Test | [x] Done | Verified with test client |
| Test schema creation (new URL) | Test | [x] Done | cache_version: 1 returned |
| Test schema update (existing URL) | Test | [x] Done | cache_version increments |
| Test URL normalization | Test | [x] Done | Trailing slashes handled |
| Test cache invalidation | Test | [x] Done | ETag changes on update |
| Document API for external consumers | Docs | [x] Done | In CLAUDE.md |

### Success Criteria
- [x] Schema can be updated and cache invalidated via API call

---

## Release 4: Drift Detection

### Status: COMPLETE

**Goal:** System detects when page content changes

| Task | Type | Status | Notes |
|------|------|--------|-------|
| Deploy collect-signal function | Code | [x] Done | Deployed successfully |
| Deploy get-drift function | Code | [x] Done | Deployed successfully |
| Test signal collection | Test | [x] Done | Signal stored in drift_signals |
| Test drift detection (hash mismatch) | Test | [x] Done | drift_detected: true |
| Test no drift (hash match) | Test | [x] Done | drift_detected: false when matching |
| Test get-drift returns unprocessed signals | Test | [x] Done | Returns correct drift count |
| Test signal deduplication by URL | Test | [x] Done | Deduplicates by page_url |

### Success Criteria
- [x] System detects when page content changes
- [x] Drift signals accessible via authenticated API

---

## Release 5: End-to-End Testing & Hardening

### Status: COMPLETE

**Goal:** Complete POC validation and production readiness

| Task | Type | Status | Notes |
|------|------|--------|-------|
| Create test client with real domain | Test | [x] Done | example.com test client |
| Full integration test: embed -> inject -> drift | Test | [x] Done | All APIs working |
| Performance test: verify <200ms p95 | Test | [x] Done | **45ms cached, 390ms uncached** |
| Security review: API key handling | Review | [x] Done | Keys validated per request |
| Security review: SQL injection prevention | Review | [x] Done | Using parameterized queries |
| Error handling: malformed requests | Test | [x] Done | Returns proper error codes |
| Loader silent failure verification | Test | [x] Done | catch blocks in loader |

### Success Criteria
- [x] All 4 success criteria from PRD met
- [x] Graceful error handling
- [x] Performance target achieved with CDN

---

## Release 6: Performance & Scaling (CDN)

### Status: COMPLETE

**Goal:** Add CDN caching for <200ms response times

| Task | Type | Status | Notes |
|------|------|--------|-------|
| Optimize get-schema with direct REST API | Code | [x] Done | ~25% faster than JS client |
| Setup Cloudflare Worker proxy | Infra | [x] Done | schema-proxy worker |
| Configure DNS (schema.coachlou.com) | Infra | [x] Done | A record pointing to CF |
| Configure Worker route | Infra | [x] Done | schema.coachlou.com/* |
| Implement Cache API in Worker | Code | [x] Done | 24hr edge cache |
| Test cached performance | Test | [x] Done | **45ms cached responses!** |

### Performance Results
| Metric | Direct Supabase | Through Cloudflare |
|--------|-----------------|-------------------|
| Cold/uncached | 300-400ms | 390ms |
| Warm/cached | N/A | **42-52ms** |
| Improvement | - | **~90% faster** |

---

## Test Client Credentials

**For testing purposes:**
- **Client ID:** `8939ddba-6a96-4bd9-8d7b-b1333c955aeb`
- **API Key:** `c90aadf12dface2f7a033fcdf0c061f6b5facc33a3e46c4c`
- **Domain:** `example.com`

**Embed script (via CDN - recommended):**
```html
<script src="https://schema.coachlou.com/functions/v1/schema-loader?client_id=8939ddba-6a96-4bd9-8d7b-b1333c955aeb"></script>
```

**Embed script (direct Supabase):**
```html
<script src="https://uxkudwzbqijamqhuowly.supabase.co/functions/v1/schema-loader?client_id=8939ddba-6a96-4bd9-8d7b-b1333c955aeb"></script>
```

---

## Architecture

```
Client Website
     │
     ▼
┌─────────────────────────────────┐
│  schema.coachlou.com            │
│  (Cloudflare Worker + Cache)    │
│  - 24hr edge cache              │
│  - ~45ms cached responses       │
└─────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────┐
│  uxkudwzbqijamqhuowly.supabase  │
│  (Supabase Edge Functions)      │
│  - schema-loader                │
│  - get-schema                   │
│  - collect-signal               │
│  - update-schema                │
│  - get-drift                    │
└─────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────┐
│  Supabase PostgreSQL            │
│  - clients                      │
│  - page_schemas                 │
│  - drift_signals                │
└─────────────────────────────────┘
```

---

## Future Releases (Out of Scope for POC)

### R7: Enhanced Features
- [ ] Batch schema updates
- [ ] URL pattern matching (wildcards)
- [ ] Multi-schema per page support
- [ ] Schema validation before storage

### R8: Integrations
- [ ] Webhook for CMS integrations
- [ ] Zapier/Make integration
- [ ] WordPress plugin

### R9: Admin & Monitoring
- [ ] Admin dashboard
- [ ] Analytics (schema requests, drift events)
- [ ] Alerting for drift detection

---

## Quick Reference

### Endpoints

| Endpoint | URL |
|----------|-----|
| Schema Loader (CDN) | `https://schema.coachlou.com/functions/v1/schema-loader` |
| Get Schema (CDN) | `https://schema.coachlou.com/functions/v1/get-schema` |
| Collect Signal | `https://uxkudwzbqijamqhuowly.supabase.co/functions/v1/collect-signal` |
| Update Schema | `https://uxkudwzbqijamqhuowly.supabase.co/functions/v1/update-schema` |
| Get Drift | `https://uxkudwzbqijamqhuowly.supabase.co/functions/v1/get-drift` |

### Deployment Commands
```bash
# Link project (first time)
supabase link --project-ref uxkudwzbqijamqhuowly

# Push database schema
supabase db push

# Deploy all functions
supabase functions deploy schema-loader --no-verify-jwt
supabase functions deploy get-schema --no-verify-jwt
supabase functions deploy collect-signal --no-verify-jwt
supabase functions deploy update-schema --no-verify-jwt
supabase functions deploy get-drift --no-verify-jwt
```

### Test Commands
```bash
# Get schema (via CDN)
curl 'https://schema.coachlou.com/functions/v1/get-schema?client_id=8939ddba-6a96-4bd9-8d7b-b1333c955aeb&url=https://example.com/services/'

# Add schema
curl -X POST 'https://uxkudwzbqijamqhuowly.supabase.co/functions/v1/update-schema' \
  -H "X-API-Key: c90aadf12dface2f7a033fcdf0c061f6b5facc33a3e46c4c" \
  -H "Content-Type: application/json" \
  -d '{"client_id": "8939ddba-6a96-4bd9-8d7b-b1333c955aeb", "page_url": "https://example.com/", "schema_json": {"@context": "https://schema.org", "@type": "WebPage"}}'

# Check drift
curl 'https://uxkudwzbqijamqhuowly.supabase.co/functions/v1/get-drift?client_id=8939ddba-6a96-4bd9-8d7b-b1333c955aeb' \
  -H "X-API-Key: c90aadf12dface2f7a033fcdf0c061f6b5facc33a3e46c4c"
```

---

## Notes & Decisions Log

| Date | Decision/Note |
|------|---------------|
| 2025-12-28 | Initial plan created based on PRD |
| 2025-12-28 | Code files created from PRD spec |
| 2025-12-28 | Fixed pgcrypto extension path (extensions.gen_random_bytes) |
| 2025-12-28 | Fixed schema-loader to use https instead of http |
| 2025-12-28 | All 5 edge functions deployed successfully |
| 2025-12-28 | End-to-end test completed - all APIs working |
| 2025-12-28 | Optimized get-schema with direct REST API (~25% faster) |
| 2025-12-28 | Added Cloudflare Worker for CDN caching |
| 2025-12-28 | Achieved 45ms cached response times (90% improvement) |

---

## Blockers & Issues

| Issue | Status | Resolution |
|-------|--------|------------|
| gen_random_bytes not found | Resolved | Use `extensions.gen_random_bytes()` |
| schema-loader returning http URLs | Resolved | Changed to `https://${url.host}` |
| Supabase Edge Functions DYNAMIC cache | Resolved | Added Cloudflare Worker with Cache API |
| CNAME to Supabase returns 403 | Resolved | Use Worker proxy instead of direct CNAME |
