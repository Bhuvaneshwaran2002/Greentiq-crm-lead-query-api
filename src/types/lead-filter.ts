export type UserRole = 'owner' | 'admin' | 'manager' | 'agent';

export type CurrentUser = {
  tenantId: string;
  userId: string;
  role: UserRole;
};

export type LeadFilterFieldType = 'string' | 'number' | 'date' | 'boolean';

export type LeadFilterCondition =
  | 'is'
  | 'is not'
  | 'contain'
  | 'does not contain'
  | 'starts with'
  | 'ends with'
  | 'before'
  | 'after'
  | 'greater than'
  | 'less than'
  | 'is empty'
  | 'is not empty'
  | 'is true'
  | 'is false';

export type LeadFilterInput = {
  fieldId: string;
  fieldType: LeadFilterFieldType;
  condition: LeadFilterCondition | string;
  value?: unknown;
};

export type LeadQueryPayload = {
  q?: string;
  logic?: 'AND' | 'OR';
  filters?: LeadFilterInput[];
};

export type QueryOptions = {
  page: number;
  limit: number;
  sortBy: 'createdAt' | 'followUpDate';
  sortDirection: 'asc' | 'desc';
};

export type NormalizedFilter = LeadFilterInput & {
  normalizedValue?: string | number | boolean | string[] | null;
  customFieldId?: string;
  customFieldType?: LeadFilterFieldType;
  customMatchKey?: string;
  systemField?: string;
};
