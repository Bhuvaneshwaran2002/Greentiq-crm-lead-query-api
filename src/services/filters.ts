import { z } from 'zod';
import { BadRequestError } from '../errors.js';
import type { LeadFilterFieldType, LeadFilterInput, LeadQueryPayload, NormalizedFilter, QueryOptions } from '../types/lead-filter.js';

const VALID_SYSTEM_FIELDS: Record<string, { type: LeadFilterFieldType; validConditions: Set<string> }> = {
  name: { type: 'string', validConditions: new Set(['is', 'is not', 'contain', 'does not contain', 'starts with', 'ends with', 'is empty', 'is not empty']) },
  phone: { type: 'string', validConditions: new Set(['is', 'is not', 'contain', 'does not contain', 'starts with', 'ends with', 'is empty', 'is not empty']) },
  email: { type: 'string', validConditions: new Set(['is', 'is not', 'contain', 'does not contain', 'starts with', 'ends with', 'is empty', 'is not empty']) },
  assignedTo: { type: 'string', validConditions: new Set(['is', 'is not', 'contain', 'does not contain']) },
  createdBy: { type: 'string', validConditions: new Set(['is', 'is not', 'contain', 'does not contain']) },
  followUpDate: { type: 'date', validConditions: new Set(['before', 'after', 'is', 'is empty', 'is not empty']) },
  createdAt: { type: 'date', validConditions: new Set(['before', 'after', 'is', 'is empty', 'is not empty']) },
  updatedAt: { type: 'date', validConditions: new Set(['before', 'after', 'is', 'is empty', 'is not empty']) },
};

export const querySchema = z.object({
  q: z.string().trim().optional(),
  logic: z.enum(['AND', 'OR']).default('AND'),
  filters: z.array(
    z.object({
      fieldId: z.string().min(1),
      fieldType: z.enum(['string', 'number', 'date', 'boolean']),
      condition: z.string().min(1),
      value: z.any().optional(),
    })
  ).default([]),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'followUpDate']).default('createdAt'),
  sortDirection: z.enum(['asc', 'desc']).default('desc'),
});

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function normalizeFilters(payload: LeadQueryPayload): NormalizedFilter[] {
  return (payload.filters ?? []).map((filter) => {
    const fieldType = filter.fieldType as LeadFilterFieldType;
    const condition = String(filter.condition ?? '').trim();
    const normalized: NormalizedFilter = { ...filter, condition, fieldType };

    if (fieldType === 'string') {
      if (filter.value === null || filter.value === undefined || filter.value === '') {
        normalized.normalizedValue = null;
      } else if (typeof filter.value === 'string') {
        normalized.normalizedValue = filter.value;
      } else throw new BadRequestError(`Invalid string value for field '${filter.fieldId}'`);
    }

    if (fieldType === 'number') {
      if (filter.value === null || filter.value === undefined || filter.value === '') {
        normalized.normalizedValue = null;
      } else if (typeof filter.value === 'number') {
        normalized.normalizedValue = filter.value;
      } else if (typeof filter.value === 'string') {
        const value = filter.value.trim();
        if (!value) {
          normalized.normalizedValue = null;
        } else {
          const parsed = Number(value);
          if (!Number.isFinite(parsed)) throw new BadRequestError(`Invalid number value for field '${filter.fieldId}'`);
          normalized.normalizedValue = parsed;
        }
      } else throw new BadRequestError(`Invalid number value for field '${filter.fieldId}'`);
    }

    if (fieldType === 'date') {
      if (filter.value === null || filter.value === undefined || filter.value === '') {
        normalized.normalizedValue = null;
      } else if (typeof filter.value === 'string') {
        const value = filter.value.trim();
        if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) {
          throw new BadRequestError(`Invalid date value for field '${filter.fieldId}'. Use YYYY-MM-DD.`);
        }
        const date = new Date(`${value}T00:00:00.000Z`);
        if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
          throw new BadRequestError(`Invalid date value for field '${filter.fieldId}'. Use YYYY-MM-DD.`);
        }
        normalized.normalizedValue = value;
      } else throw new BadRequestError(`Invalid date value for field '${filter.fieldId}'. Use YYYY-MM-DD.`);
    }

    if (fieldType === 'boolean') {
      if (filter.value === 'true' || filter.value === true) normalized.normalizedValue = true;
      else if (filter.value === 'false' || filter.value === false) normalized.normalizedValue = false;
      else if (filter.value === null || filter.value === undefined || filter.value === '') normalized.normalizedValue = null;
      else throw new BadRequestError(`Invalid boolean value for field '${filter.fieldId}'`);
    }

    return normalized;
  });
}

export function validateFilter(filter: LeadFilterInput): NormalizedFilter {
  const fieldId = String(filter.fieldId ?? '').trim();
  if (!fieldId) throw new BadRequestError('Each filter must include a fieldId');

  const fieldType = filter.fieldType as LeadFilterFieldType;
  const condition = String(filter.condition ?? '').trim();
  const systemFilter = VALID_SYSTEM_FIELDS[fieldId];

  if (!['string', 'number', 'date', 'boolean'].includes(fieldType)) {
    throw new BadRequestError(`Invalid fieldType for field '${fieldId}'`);
  }

  if (systemFilter) {
    if (systemFilter.type !== fieldType) throw new BadRequestError(`Field type mismatch for '${fieldId}'`);
    if (!systemFilter.validConditions.has(condition)) throw new BadRequestError(`Invalid condition '${condition}' for field '${fieldId}'`);
    return { ...filter, fieldId, condition, fieldType, systemField: fieldId };
  }

  if (!isUuid(fieldId)) throw new BadRequestError(`Invalid custom field UUID: ${fieldId}`);

  if (condition === 'is true' || condition === 'is false') {
    if (fieldType !== 'boolean') throw new BadRequestError(`Condition '${condition}' is not valid for non-boolean custom fields.`);
  }

  if (fieldType === 'boolean' && condition !== 'is' && condition !== 'is true' && condition !== 'is false' && condition !== 'is empty' && condition !== 'is not empty') {
    throw new BadRequestError(`Invalid condition '${condition}' for boolean custom field.`);
  }

  const customConditions: Record<LeadFilterFieldType, string[]> = {
    string: ['is', 'is not', 'contain', 'does not contain', 'starts with', 'ends with', 'is empty', 'is not empty'],
    number: ['is', 'greater than', 'less than', 'is empty', 'is not empty'],
    date: ['is', 'before', 'after', 'is empty', 'is not empty'],
    boolean: ['is', 'is true', 'is false', 'is empty', 'is not empty'],
  };
  if (!customConditions[fieldType].includes(condition)) {
    throw new BadRequestError(`Invalid condition '${condition}' for custom field '${fieldId}'`);
  }

  return { ...filter, fieldId, condition, fieldType, customFieldId: fieldId, customFieldType: fieldType };
}

export function getQueryOptions(raw: unknown): QueryOptions {
  const parsed = paginationSchema.safeParse(raw);
  if (!parsed.success) {
    throw new BadRequestError(parsed.error.issues.map((issue) => issue.message).join('; '));
  }
  return parsed.data;
}

