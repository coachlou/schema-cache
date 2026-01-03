#!/usr/bin/env -S deno run --allow-net --allow-env

/**
 * Script to populate Supabase database with sample data
 * Usage: deno run --allow-net --allow-env scripts/seed-data.ts
 *
 * Set environment variables:
 * - SUPABASE_URL (or defaults to uxkudwzbqijamqhuowly project)
 * - SUPABASE_SERVICE_ROLE_KEY (required)
 */

const PROJECT_REF = Deno.env.get("SUPABASE_PROJECT_REF") || "uxkudwzbqijamqhuowly";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const BASE_URL = `https://${PROJECT_REF}.supabase.co`;

if (!SERVICE_ROLE_KEY) {
  console.error("❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required");
  console.error("\nUsage:");
  console.error("  SUPABASE_SERVICE_ROLE_KEY=your-key deno run --allow-net --allow-env scripts/seed-data.ts");
  Deno.exit(1);
}

interface Organization {
  id: string;
  name: string;
  domain: string;
  base_url: string;
  api_key: string;
}

async function createOrganization(): Promise<Organization> {
  console.log("🔧 Creating organization...");

  const response = await fetch(`${BASE_URL}/rest/v1/organizations`, {
    method: "POST",
    headers: {
      "apikey": SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
    },
    body: JSON.stringify({
      name: "Test Organization",
      domain: "example.com",
      base_url: "https://example.com",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create organization: ${error}`);
  }

  const organizations = await response.json() as Organization[];
  const organization = organizations[0];

  console.log("✅ Organization created!");
  console.log(`   Organization ID: ${organization.id}`);
  console.log(`   API Key: ${organization.api_key}`);
  console.log(`   Domain: ${organization.domain}`);
  console.log(`   Base URL: ${organization.base_url}`);

  return organization;
}

async function addSchema(
  organizationId: string,
  apiKey: string,
  pageUrl: string,
  schemaJson: Record<string, unknown>,
  description: string
): Promise<void> {
  const response = await fetch(`${BASE_URL}/functions/v1/update-schema`, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      organization_id: organizationId,
      page_url: pageUrl,
      schema_json: schemaJson,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`   ❌ Failed to add ${description}: ${error}`);
  } else {
    console.log(`   ✅ ${description}`);
  }
}

async function main() {
  try {
    // Create organization
    const organization = await createOrganization();

    console.log("\n📝 Adding sample schemas...");

    // Add homepage schema
    await addSchema(
      organization.id,
      organization.api_key,
      "https://example.com/",
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": "Example Homepage",
        "description": "Welcome to our example website",
      },
      "Homepage schema added"
    );

    // Add services page schema
    await addSchema(
      organization.id,
      organization.api_key,
      "https://example.com/services/",
      {
        "@context": "https://schema.org",
        "@type": "Service",
        "name": "Our Services",
        "provider": {
          "@type": "Organization",
          "name": "Example Company",
        },
      },
      "Services schema added"
    );

    // Add about page schema
    await addSchema(
      organization.id,
      organization.api_key,
      "https://example.com/about/",
      {
        "@context": "https://schema.org",
        "@type": "AboutPage",
        "name": "About Us",
        "description": "Learn more about our company",
      },
      "About schema added"
    );

    // Add contact page with more complex schema
    await addSchema(
      organization.id,
      organization.api_key,
      "https://example.com/contact/",
      {
        "@context": "https://schema.org",
        "@type": "ContactPage",
        "name": "Contact Us",
        "mainEntity": {
          "@type": "Organization",
          "name": "Example Company",
          "contactPoint": {
            "@type": "ContactPoint",
            "telephone": "+1-555-555-5555",
            "contactType": "Customer Service",
          },
        },
      },
      "Contact schema added"
    );

    console.log("\n✅ Sample data created successfully!");
    console.log("\n🚀 Test the schema loader:");
    console.log(`   curl '${BASE_URL}/functions/v1/schema-loader?client_id=${organization.id}'`);
    console.log("\n🔍 Fetch a schema:");
    console.log(`   curl '${BASE_URL}/functions/v1/get-schema?client_id=${organization.id}&url=https://example.com/services/'`);
    console.log("\n📋 Add this to your HTML <head>:");
    console.log(`   <script src="${BASE_URL}/functions/v1/schema-loader?client_id=${organization.id}"></script>`);
    console.log("\n💾 Save these credentials:");
    console.log(`   Organization ID: ${organization.id}`);
    console.log(`   API Key: ${organization.api_key}`);

  } catch (error) {
    console.error("❌ Error:", error.message);
    Deno.exit(1);
  }
}

main();
