import 'dotenv/config';
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

const tenantAId = '11111111-1111-4111-8111-111111111111';
const tenantBId = '22222222-2222-4222-8222-222222222222';

const ownerAId = 'a1111111-1111-4111-8111-111111111111';
const adminAId = 'a2222222-2222-4222-8222-222222222222';
const managerAId = 'a3333333-3333-4333-8333-333333333333';
const agentA1Id = 'a4444444-4444-4444-8444-444444444444';
const agentA2Id = 'a5555555-5555-4555-8555-555555555555';

const ownerBId = 'b1111111-1111-4111-8111-111111111111';
const agentBId = 'b4444444-4444-4444-8444-444444444444';

const cityFieldId = 'c1111111-1111-4111-8111-111111111111';
const scoreFieldId = 'c2222222-2222-4222-8222-222222222222';
const dateFieldId = 'c3333333-3333-4333-8333-333333333333';
const qualifiedFieldId = 'c4444444-4444-4444-8444-444444444444';

async function main() {
  const tenantA = await prisma.tenant.upsert({
    where: { id: tenantAId },
    create: {
      id: tenantAId,
      name: 'Tenant A',
    },
    update: { name: 'Tenant A' },
  });

  const tenantB = await prisma.tenant.upsert({
    where: { id: tenantBId },
    create: {
      id: tenantBId,
      name: 'Tenant B',
    },
    update: { name: 'Tenant B' },
  });

  for (const user of [
      { id: ownerAId, tenantId: tenantA.id, name: 'Tenant A Owner', email: 'owner@tenant-a.com', role: UserRole.owner },
      { id: adminAId, tenantId: tenantA.id, name: 'Tenant A Admin', email: 'admin@tenant-a.com', role: UserRole.admin },
      { id: managerAId, tenantId: tenantA.id, name: 'Tenant A Manager', email: 'manager@tenant-a.com', role: UserRole.manager },
      { id: agentA1Id, tenantId: tenantA.id, name: 'Agent A1', email: 'agent-a1@tenant-a.com', role: UserRole.agent },
      { id: agentA2Id, tenantId: tenantA.id, name: 'Agent A2', email: 'agent-a2@tenant-a.com', role: UserRole.agent },
      { id: ownerBId, tenantId: tenantB.id, name: 'Tenant B Owner', email: 'owner@tenant-b.com', role: UserRole.owner },
      { id: agentBId, tenantId: tenantB.id, name: 'Tenant B Agent', email: 'agent@tenant-b.com', role: UserRole.agent },
    ]) {
    await prisma.user.upsert({ where: { id: user.id }, create: user, update: { tenantId: user.tenantId, name: user.name, email: user.email, role: user.role } });
  }

  const leads = [
    { id: 'd1111111-1111-4111-8111-111111111111', name: 'Ram Kumar', phone: '9000000001', countryCode: '+91', e164: '+919000000001', email: 'ram.kumar@example.com', assignedTo: agentA1Id, followUpDate: '2026-08-10', createdBy: ownerAId },
    { id: 'd2222222-2222-4222-8222-222222222222', name: 'Ramesh', phone: '9000000002', countryCode: '+91', e164: '+919000000002', email: 'ramesh@example.com', assignedTo: agentA1Id, followUpDate: '2026-07-01', createdBy: adminAId },
    { id: 'd3333333-3333-4333-8333-333333333333', name: 'Priya', phone: '9000000003', countryCode: '+91', e164: '+919000000003', email: 'priya@example.com', assignedTo: agentA2Id, followUpDate: null, createdBy: managerAId },
    { id: 'd4444444-4444-4444-8444-444444444444', name: 'Anand', phone: '9000000004', countryCode: '+91', e164: '+919000000004', email: 'anand@example.com', assignedTo: null, followUpDate: '2026-08-15', createdBy: ownerAId },
    { id: 'd5555555-5555-4555-8555-555555555555', name: 'Sita', phone: '9000000005', countryCode: '+91', e164: '+919000000005', email: 'sita@example.com', assignedTo: agentA2Id, followUpDate: '2026-08-01', createdBy: adminAId },
  ];

  for (const lead of leads) {
    await prisma.lead.upsert({
      where: { id: lead.id },
      create: {
        id: lead.id,
        tenantId: tenantA.id,
        userId: lead.createdBy,
        name: lead.name,
        phone: lead.phone,
        countryCode: lead.countryCode,
        e164: lead.e164,
        email: lead.email,
        assignedTo: lead.assignedTo,
        followUpDate: lead.followUpDate ? new Date(lead.followUpDate) : null,
      },
      update: { tenantId: tenantA.id, userId: lead.createdBy, name: lead.name, phone: lead.phone, countryCode: lead.countryCode, e164: lead.e164, email: lead.email, assignedTo: lead.assignedTo, followUpDate: lead.followUpDate ? new Date(lead.followUpDate) : null },
    });
  }

  const tenantBLeads = [
    { id: 'e1111111-1111-4111-8111-111111111111', name: 'Tenant B Lead One', phone: '9000000091', countryCode: '+91', e164: '+919000000091', email: 'b1@example.com', assignedTo: agentBId },
    { id: 'e2222222-2222-4222-8222-222222222222', name: 'Tenant B Lead Two', phone: '9000000092', countryCode: '+91', e164: '+919000000092', email: 'b2@example.com', assignedTo: null },
  ];

  for (const lead of tenantBLeads) {
    await prisma.lead.upsert({
      where: { id: lead.id },
      create: {
        id: lead.id,
        tenantId: tenantB.id,
        userId: ownerBId,
        name: lead.name,
        phone: lead.phone,
        countryCode: lead.countryCode,
        e164: lead.e164,
        email: lead.email,
        assignedTo: lead.assignedTo,
      },
      update: { tenantId: tenantB.id, userId: ownerBId, name: lead.name, phone: lead.phone, countryCode: lead.countryCode, e164: lead.e164, email: lead.email, assignedTo: lead.assignedTo },
    });
  }

  for (const field of [
    { id: cityFieldId, label: 'City', type: 'string' as const },
    { id: scoreFieldId, label: 'Score', type: 'number' as const },
    { id: dateFieldId, label: 'Signup Date', type: 'date' as const },
    { id: qualifiedFieldId, label: 'Qualified', type: 'boolean' as const },
  ]) {
    await prisma.customField.upsert({
      where: { id: field.id },
      create: {
      id: field.id,
      tenantId: tenantA.id,
      label: field.label,
      type: field.type,
      status: true,
      },
      update: { tenantId: tenantA.id, label: field.label, type: field.type, status: true },
    });
  }

  const cityValues = [
    ['d1111111-1111-4111-8111-111111111111', 'Chennai'],
    ['d2222222-2222-4222-8222-222222222222', 'Madurai'],
    ['d3333333-3333-4333-8333-333333333333', 'Chennai'],
    ['d4444444-4444-4444-8444-444444444444', 'Coimbatore'],
    ['d5555555-5555-4555-8555-555555555555', 'Chennai'],
  ];

  for (const [leadId, value] of cityValues) {
    await prisma.leadCustomFieldValue.upsert({ where: { leadId_fieldId: { leadId, fieldId: cityFieldId } }, create: { leadId, fieldId: cityFieldId, value }, update: { value } });
  }

  const typedValues = [
    [scoreFieldId, [['d1111111-1111-4111-8111-111111111111', '9'], ['d2222222-2222-4222-8222-222222222222', '10'], ['d3333333-3333-4333-8333-333333333333', '5'], ['d4444444-4444-4444-8444-444444444444', '12'], ['d5555555-5555-4555-8555-555555555555', '7']]],
    [dateFieldId, [['d1111111-1111-4111-8111-111111111111', '2026-08-10'], ['d2222222-2222-4222-8222-222222222222', '2026-07-01'], ['d3333333-3333-4333-8333-333333333333', '2026-06-15'], ['d4444444-4444-4444-8444-444444444444', '2026-08-15'], ['d5555555-5555-4555-8555-555555555555', '2026-08-01']]],
    [qualifiedFieldId, [['d1111111-1111-4111-8111-111111111111', 'true'], ['d2222222-2222-4222-8222-222222222222', 'false'], ['d3333333-3333-4333-8333-333333333333', 'true'], ['d4444444-4444-4444-8444-444444444444', 'false'], ['d5555555-5555-4555-8555-555555555555', 'true']]],
  ] as const;
  for (const [fieldId, values] of typedValues) {
    for (const [leadId, value] of values) {
      await prisma.leadCustomFieldValue.upsert({ where: { leadId_fieldId: { leadId, fieldId } }, create: { leadId, fieldId, value }, update: { value } });
    }
  }

  console.log('Seed complete with Tenant A and Tenant B dataset.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
