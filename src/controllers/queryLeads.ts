import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/client.js';
import { BadRequestError, UnauthorizedError } from '../errors.js';
import { getQueryOptions, isUuid, normalizeFilters, querySchema, validateFilter } from '../services/filters.js';
import type { NormalizedFilter, UserRole } from '../types/lead-filter.js';

type RawLead = {
  id: string;
  tenant_id: string;
  user_id: string;
  name: string;
  phone: string;
  country_code: string;
  e164: string;
  email: string | null;
  assigned_to: string | null;
  follow_up_date: Date | null;
  created_at: Date;
  updated_at: Date;
};

export async function queryLeads(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const payload = querySchema.safeParse(req.body ?? {});
    if (!payload.success) throw new BadRequestError(payload.error.issues.map((issue) => issue.message).join('; '));

    const body = payload.data;
    const options = getQueryOptions(req.query);
    const filters = (body.filters ?? []).map((filter) => validateFilter(filter));
    const normalized = normalizeFilters({ ...body, filters });
    await validateCustomFields(normalized, req.user.tenantId);

    const whereSql = buildRawWhere(req.user.tenantId, req.user.userId, req.user.role, body.q, normalized, body.logic);
    const orderColumn = options.sortBy === 'followUpDate' ? Prisma.raw('"follow_up_date"') : Prisma.raw('"created_at"');
    const orderDirection = Prisma.raw(options.sortDirection.toUpperCase());
    const [records, countRows] = await Promise.all([
      prisma.$queryRaw<RawLead[]>(Prisma.sql`SELECT "id", "tenant_id", "user_id", "name", "phone", "country_code", "e164", "email", "assigned_to", "follow_up_date", "created_at", "updated_at" FROM "leads" l WHERE ${whereSql} ORDER BY ${orderColumn} ${orderDirection} NULLS LAST LIMIT ${options.limit} OFFSET ${(options.page - 1) * options.limit}`),
      prisma.$queryRaw<[{ count: bigint }]>(Prisma.sql`SELECT COUNT(*)::bigint AS count FROM "leads" l WHERE ${whereSql}`),
    ]);

    const pageIds = records.map((lead) => lead.id);
    const customValues = pageIds.length === 0 ? [] : await prisma.leadCustomFieldValue.findMany({
      where: { leadId: { in: pageIds }, lead: { tenantId: req.user.tenantId }, field: { tenantId: req.user.tenantId } },
      include: { field: true },
    });
    const valuesByLead = new Map<string, typeof customValues>();
    for (const value of customValues) valuesByLead.set(value.leadId, [...(valuesByLead.get(value.leadId) ?? []), value]);
    const totalRecords = Number(countRows[0]?.count ?? 0n);

    res.status(200).json({
      status: 'success', message: 'Leads fetched successfully',
      data: records.map((lead) => ({
        id: lead.id, tenantId: lead.tenant_id, userId: lead.user_id, name: lead.name, phone: lead.phone,
        countryCode: lead.country_code, e164: lead.e164, email: lead.email, assignedTo: lead.assigned_to,
        followUpDate: lead.follow_up_date ? lead.follow_up_date.toISOString().slice(0, 10) : null,
        createdAt: lead.created_at.toISOString(), updatedAt: lead.updated_at.toISOString(),
        customFields: (valuesByLead.get(lead.id) ?? []).map((entry) => ({ fieldId: entry.fieldId, label: entry.field.label, value: entry.value })),
      })),
      meta: { page: options.page, limit: options.limit, totalRecords, totalPages: Math.ceil(totalRecords / options.limit) },
    });
  } catch (error) {
    next(error);
  }
}

async function validateCustomFields(filters: NormalizedFilter[], tenantId: string) {
  const customFilters = filters.filter((filter) => !filter.systemField);
  const ids = [...new Set(customFilters.map((filter) => filter.customFieldId).filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return;
  const fields = await prisma.customField.findMany({ where: { tenantId, id: { in: ids } }, select: { id: true, type: true } });
  const types = new Map(fields.map((field) => [field.id, field.type]));
  for (const filter of customFilters) {
    const fieldId = filter.customFieldId as string;
    if (!types.has(fieldId)) throw new BadRequestError(`Custom field '${fieldId}' does not exist for this tenant`);
    if (types.get(fieldId) !== filter.fieldType) throw new BadRequestError(`Field type mismatch for custom field '${fieldId}'`);
  }
}

function buildRawWhere(tenantId: string, userId: string, role: UserRole, q: string | undefined, filters: NormalizedFilter[], logic: 'AND' | 'OR') {
  const clauses: Prisma.Sql[] = [Prisma.sql`l."tenant_id" = ${tenantId}::uuid`];
  if (role === 'agent') clauses.push(Prisma.sql`l."assigned_to" = ${userId}::uuid`);
  if (q?.trim()) {
    const value = `%${q.trim()}%`;
    clauses.push(Prisma.sql`(l."name" ILIKE ${value} OR l."phone" ILIKE ${value} OR l."email" ILIKE ${value} OR l."e164" ILIKE ${value})`);
  }
  const filterClauses = filters.map((filter) => filter.systemField ? buildSystemSql(filter) : buildCustomSql(filter, tenantId));
  if (filterClauses.length) clauses.push(logic === 'OR' ? Prisma.sql`(${Prisma.join(filterClauses, ' OR ')})` : Prisma.sql`(${Prisma.join(filterClauses, ' AND ')})`);
  return Prisma.join(clauses, ' AND ');
}

function buildSystemSql(filter: NormalizedFilter): Prisma.Sql {
  const column = filter.systemField === 'name' ? 'name' : filter.systemField === 'phone' ? 'phone' : filter.systemField === 'email' ? 'email' : filter.systemField === 'assignedTo' ? 'assigned_to' : filter.systemField === 'createdBy' ? 'user_id' : filter.systemField === 'followUpDate' ? 'follow_up_date' : filter.systemField === 'createdAt' ? 'created_at' : 'updated_at';
  const rawCol = Prisma.raw(`l."${column}"`);
  const col = Prisma.raw(`l."${column}"${column === 'assigned_to' || column === 'user_id' ? '::text' : ''}`);
  const value = filter.normalizedValue;
  if (column === 'assigned_to' || column === 'user_id') {
    const ids = String(value ?? '').split(',').map((id) => id.trim()).filter(Boolean);
    if (ids.some((id) => !isUuid(id))) throw new BadRequestError(`${filter.systemField} values must be valid UUIDs`);
    if (ids.length === 0) return Prisma.sql`${rawCol} IS NULL`;
    const idParams = Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`), ', ');
    if (filter.condition === 'is' || filter.condition === 'contain') return Prisma.sql`${rawCol} IN (${idParams})`;
    if (column === 'assigned_to') return Prisma.sql`(${rawCol} IS NULL OR ${rawCol} NOT IN (${idParams}))`;
    return Prisma.sql`${rawCol} NOT IN (${idParams})`;
  }
  if (filter.fieldType === 'string') {
    const text = String(value ?? '').trim();
    if (filter.condition === 'is') return Prisma.sql`${col} ILIKE ${text}`;
    if (filter.condition === 'is not') return Prisma.sql`(${col} IS NULL OR ${col} NOT ILIKE ${text})`;
    if (filter.condition === 'contain') return Prisma.sql`${col} ILIKE ${`%${text}%`}`;
    if (filter.condition === 'does not contain') return Prisma.sql`(${col} IS NULL OR ${col} NOT ILIKE ${`%${text}%`})`;
    if (filter.condition === 'starts with') return Prisma.sql`${col} ILIKE ${`${text}%`}`;
    if (filter.condition === 'ends with') return Prisma.sql`${col} ILIKE ${`%${text}`}`;
    if (filter.condition === 'is empty') return Prisma.sql`(${col} IS NULL OR ${col} = '')`;
    return Prisma.sql`(${col} IS NOT NULL AND ${col} <> '')`;
  }
  if (filter.condition === 'is empty') return Prisma.sql`${col} IS NULL`;
  if (filter.condition === 'is not empty') return Prisma.sql`${col} IS NOT NULL`;
  if (filter.condition === 'is') return Prisma.sql`${col}::date = ${String(value)}::date`;
  return filter.condition === 'before' ? Prisma.sql`${col} < ${String(value)}::date` : Prisma.sql`${col} > ${String(value)}::date`;
}

function buildCustomSql(filter: NormalizedFilter, tenantId: string): Prisma.Sql {
  const fieldId = filter.customFieldId as string;
  const value = filter.normalizedValue;
  const fieldMatch = Prisma.sql`v."field_id" = ${fieldId}::uuid AND f."tenant_id" = ${tenantId}::uuid AND v."lead_id" = l."id"`;
  if (filter.condition === 'is empty') return Prisma.sql`NOT EXISTS (SELECT 1 FROM "lead_custom_field_values" v JOIN "custom_fields" f ON f."id" = v."field_id" WHERE ${fieldMatch} AND v."value" <> '')`;
  if (filter.condition === 'is not empty') return Prisma.sql`EXISTS (SELECT 1 FROM "lead_custom_field_values" v JOIN "custom_fields" f ON f."id" = v."field_id" WHERE ${fieldMatch} AND v."value" <> '')`;

  let predicate: Prisma.Sql;
  if (filter.fieldType === 'number') {
    const numberValue = Prisma.sql`CASE WHEN v."value" ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN v."value"::numeric ELSE NULL END`;
    predicate = filter.condition === 'is' ? Prisma.sql`${numberValue} = ${Number(value)}` : filter.condition === 'greater than' ? Prisma.sql`${numberValue} > ${Number(value)}` : Prisma.sql`${numberValue} < ${Number(value)}`;
  } else if (filter.fieldType === 'date') {
    const dateValue = Prisma.sql`CASE WHEN v."value" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND to_char(to_date(v."value", 'YYYY-MM-DD'), 'YYYY-MM-DD') = v."value" THEN to_date(v."value", 'YYYY-MM-DD') ELSE NULL END`;
    predicate = filter.condition === 'is' ? Prisma.sql`${dateValue} = ${String(value)}::date` : filter.condition === 'before' ? Prisma.sql`${dateValue} < ${String(value)}::date` : Prisma.sql`${dateValue} > ${String(value)}::date`;
  } else if (filter.fieldType === 'boolean') {
    const expectedBoolean = filter.condition === 'is true' ? true : filter.condition === 'is false' ? false : value;
    predicate = Prisma.sql`lower(v."value") = ${String(expectedBoolean)}`;
  } else {
    const text = String(value ?? '').toLowerCase();
    predicate = filter.condition === 'is' ? Prisma.sql`v."value" ILIKE ${text}` : filter.condition === 'is not' ? Prisma.sql`v."value" NOT ILIKE ${text}` : filter.condition === 'contain' ? Prisma.sql`v."value" ILIKE ${`%${text}%`}` : filter.condition === 'does not contain' ? Prisma.sql`v."value" NOT ILIKE ${`%${text}%`}` : filter.condition === 'starts with' ? Prisma.sql`v."value" ILIKE ${`${text}%`}` : Prisma.sql`v."value" ILIKE ${`%${text}`}`;
  }
  const positive = Prisma.sql`EXISTS (SELECT 1 FROM "lead_custom_field_values" v JOIN "custom_fields" f ON f."id" = v."field_id" WHERE ${fieldMatch} AND ${predicate})`;
  return filter.condition === 'is not' || filter.condition === 'does not contain' ? Prisma.sql`NOT ${positive}` : positive;
}
