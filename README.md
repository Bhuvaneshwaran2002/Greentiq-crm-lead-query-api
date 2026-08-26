# Lead Query API

## Overview
This project provides a standalone multi-tenant CRM Leads Query API built with Express, TypeScript, Prisma, and PostgreSQL. It exposes a single authenticated endpoint for filtering, searching, sorting, and paginating leads while enforcing tenant isolation and agent visibility rules.

## Stack
- Node.js 20+
- Express
- TypeScript
- Prisma ORM
- PostgreSQL
- Zod validation
- dotenv

## Setup
1. Copy `.env.example` to `.env` and set your local PostgreSQL connection string.
2. Create a database: `greentiq_crm` (or another empty database you own).
3. Run `npm install`.
4. Run `npx prisma generate`.
5. Run `npx prisma migrate deploy`.
6. Run `npm run seed`.
7. Start the server with `npm run dev`.

## PostgreSQL configuration
Use a local PostgreSQL instance. The connection string is stored in `.env` and must look like:

`DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/greentiq_crm?schema=public"`

Do not commit or share the real password.

## Environment variables
- `DATABASE_URL`: PostgreSQL datasource URL
- `PORT`: Optional, defaults to 3000
- `CORS_ORIGIN`: Optional comma-separated list of allowed browser origins. If omitted, browser requests from any origin are allowed without credentials.
- `OPENAPI_SERVER_URL`: Optional server URL shown in Swagger UI. Defaults to the current deployment origin.

## Migration and Prisma
- `npx prisma validate`
- `npx prisma generate`
- `npx prisma migrate deploy` applies the existing migrations for a fresh environment.
- `npx prisma migrate dev --name <migration-name>` is for creating a new migration during development, not normal first-time deployment when migrations already exist.

## Seed
- `npm run seed`

## Start server
- `npm run dev`

## API endpoint
`POST /api/v1/leads/query`

## Swagger
Open interactive API documentation at `/docs` (for example, `https://your-deployment.vercel.app/docs`). The raw OpenAPI document is available at `/docs.json`. Swagger's **Authorize** dialog accepts the required `x-tenant-id`, `x-user-id`, and `x-user-role` headers.

## Required headers
- `x-tenant-id`: tenant UUID
- `x-user-id`: user UUID
- `x-user-role`: `owner | admin | manager | agent`

## Query parameters
- `page` default `1`
- `limit` default `20`, range `1..100`
- `sortBy` default `createdAt`, allowed `createdAt | followUpDate`
- `sortDirection` default `desc`, allowed `asc | desc`

## Request body
```json
{
  "q": "ram",
  "logic": "AND",
  "filters": [
    {
      "fieldId": "name",
      "fieldType": "string",
      "condition": "contain",
      "value": "Ram"
    }
  ]
}
```

## Filter operators
String: `is`, `is not`, `contain`, `does not contain`, `starts with`, `ends with`, `is empty`, `is not empty`
Date: `before`, `after`, `is`, `is empty`, `is not empty`
Number: `is`, `greater than`, `less than`, `is empty`, `is not empty`
Boolean: `is true`, `is false`

Numeric and date custom-field values are stored in the EAV text column but are validated and compared as numbers/dates. Invalid stored values are ignored rather than evaluated unsafely.

## Role visibility
- `owner`, `admin`, `manager` see all leads in the tenant.
- `agent` only sees leads with `assignedTo = currentUser.userId`.

## Tenant isolation
Every query is scoped by `tenantId = x-tenant-id` and never trusts a request field value. Custom field validation is also tenant-scoped.

## Example curl commands
```bash
curl -X POST http://localhost:3000/api/v1/leads/query \
  -H 'x-tenant-id: 11111111-1111-4111-8111-111111111111' \
  -H 'x-user-id: a1111111-1111-4111-8111-111111111111' \
  -H 'x-user-role: owner' \
  -H 'Content-Type: application/json' \
  -d '{"filters":[{"fieldId":"name","fieldType":"string","condition":"contain","value":"Ram"}]}'
```

```bash
curl -X POST http://localhost:3000/api/v1/leads/query \
  -H 'x-tenant-id: 11111111-1111-4111-8111-111111111111' \
  -H 'x-user-id: a4444444-4444-4444-8444-444444444444' \
  -H 'x-user-role: agent' \
  -H 'Content-Type: application/json' \
  -d '{"logic":"AND","filters":[{"fieldId":"assignedTo","fieldType":"string","condition":"is","value":"a4444444-4444-4444-8444-444444444444"}]}'
```

## Design decisions
- Tenant and user headers are treated as the authentication context.
- Query conditions are validated before SQL generation.
- EAV data is stored in `lead_custom_field_values` and hydrated in a single include query.
- Custom field filters use parameterized PostgreSQL `EXISTS`/`NOT EXISTS` predicates; values and identifiers are never concatenated from user input.

## EAV/custom-field approach
Custom field values are stored as string values in an EAV table with a unique `(leadId, fieldId)` index. This keeps the schema flexible while preserving tenant isolation at the field and lead levels.

## Empty-value semantics
For string and custom fields, empty means `null` or an empty string. Filters using `is empty` or `is not empty` are normalized consistently.

## No-N+1 approach
The request validates all referenced custom fields in one batched query, applies filtering/counting/pagination in PostgreSQL, runs one paginated lead query, and uses one batched custom-field hydration query for the returned lead IDs. It does not issue one custom-field query per lead or per filter.

## Indexing considerations
Indexes are applied to tenant, assignedTo, userId, followUpDate, createdAt, and EAV join keys.

## Verification
Run the reproducible acceptance suite while the API is running:

`npm run acceptance`

It covers tenant isolation, role visibility, AND/OR filters, free-text phone search, multiselect agents, pagination, invalid requests, custom-field ownership, numeric comparisons, and date comparisons.

## Time spent
This implementation was built as a backend assignment project in a local workspace.

## What could be improved with another day
- dedicated automated test suite beyond the HTTP acceptance runner
- typed database columns for high-volume numeric/date analytics
- stronger pagination and sorting analytics
