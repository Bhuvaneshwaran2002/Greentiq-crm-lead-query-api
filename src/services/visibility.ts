import type { CurrentUser } from '../types/lead-filter.js';

export function buildVisibilityWhere(currentUser: CurrentUser) {
  return {
    tenantId: currentUser.tenantId,
    ...(currentUser.role === 'agent' ? { assignedTo: currentUser.userId } : {}),
  };
}
