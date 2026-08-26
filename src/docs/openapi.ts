const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'GreenTIQ Lead Query API',
    version: '1.0.0',
    description: 'Authenticated, tenant-isolated lead search for the GreenTIQ CRM.',
  },
  servers: [{ url: process.env.OPENAPI_SERVER_URL ?? '/' }],
  tags: [{ name: 'Leads' }],
  components: {
    securitySchemes: {
      tenantId: { type: 'apiKey', in: 'header', name: 'x-tenant-id', description: 'Tenant UUID.' },
      userId: { type: 'apiKey', in: 'header', name: 'x-user-id', description: 'Authenticated user UUID.' },
      userRole: { type: 'apiKey', in: 'header', name: 'x-user-role', description: 'User role: owner, admin, manager, or agent.' },
    },
    schemas: {
      LeadFilter: {
        type: 'object',
        required: ['fieldId', 'fieldType', 'condition'],
        properties: {
          fieldId: { type: 'string', description: 'System field name or custom field UUID.' },
          fieldType: { type: 'string', enum: ['string', 'number', 'date', 'boolean'] },
          condition: { type: 'string', enum: ['is', 'is not', 'contain', 'does not contain', 'starts with', 'ends with', 'before', 'after', 'greater than', 'less than', 'is empty', 'is not empty', 'is true', 'is false'] },
          value: { description: 'Filter value. Not required for empty and boolean conditions.' },
        },
      },
      LeadQuery: {
        type: 'object',
        properties: {
          q: { type: 'string', description: 'Free-text search across name, phone, email, and E.164 phone.' },
          logic: { type: 'string', enum: ['AND', 'OR'], default: 'AND' },
          filters: { type: 'array', items: { $ref: '#/components/schemas/LeadFilter' } },
        },
      },
      Lead: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          tenantId: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          phone: { type: 'string' },
          countryCode: { type: 'string' },
          e164: { type: 'string' },
          email: { type: 'string', nullable: true },
          assignedTo: { type: 'string', format: 'uuid', nullable: true },
          followUpDate: { type: 'string', format: 'date', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          customFields: { type: 'array', items: { type: 'object', properties: { fieldId: { type: 'string', format: 'uuid' }, label: { type: 'string' }, value: { type: 'string' } } } },
        },
      },
    },
  },
  paths: {
    '/api/v1/leads/query': {
      post: {
        tags: ['Leads'],
        summary: 'Query leads',
        security: [{ tenantId: [], userId: [], userRole: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
          { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['createdAt', 'followUpDate'], default: 'createdAt' } },
          { name: 'sortDirection', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
        ],
        requestBody: { required: false, content: { 'application/json': { schema: { $ref: '#/components/schemas/LeadQuery' }, example: { q: 'ram', logic: 'AND', filters: [{ fieldId: 'name', fieldType: 'string', condition: 'contain', value: 'Ram' }] } } } },
        responses: {
          200: {
            description: 'Leads fetched successfully.',
            content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', example: 'success' }, message: { type: 'string' }, data: { type: 'array', items: { $ref: '#/components/schemas/Lead' } }, meta: { type: 'object', properties: { page: { type: 'integer' }, limit: { type: 'integer' }, totalRecords: { type: 'integer' }, totalPages: { type: 'integer' } } } } } } },
          },
          400: { description: 'Invalid request, filter, or query parameter.' },
          401: { description: 'Missing or invalid authentication.' },
        },
      },
    },
  },
} as const;

export default openApiDocument;