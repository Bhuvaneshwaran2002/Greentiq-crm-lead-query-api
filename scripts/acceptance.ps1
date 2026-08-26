$ErrorActionPreference = 'Stop'
$baseUrl = 'http://localhost:3000/api/v1/leads/query'
$tenantA = '11111111-1111-4111-8111-111111111111'
$tenantB = '22222222-2222-4222-8222-222222222222'
$ownerA = 'a1111111-1111-4111-8111-111111111111'
$adminA = 'a2222222-2222-4222-8222-222222222222'
$managerA = 'a3333333-3333-4333-8333-333333333333'
$agentA1 = 'a4444444-4444-4444-8444-444444444444'
$agentA2 = 'a5555555-5555-4555-8555-555555555555'
$ownerB = 'b1111111-1111-4111-8111-111111111111'
$city = 'c1111111-1111-4111-8111-111111111111'
$score = 'c2222222-2222-4222-8222-222222222222'
$date = 'c3333333-3333-4333-8333-333333333333'
$qualified = 'c4444444-4444-4444-8444-444444444444'

function Invoke-Query($tenant, $user, $role, $body, $query = '') {
  $headers = @{ 'x-tenant-id' = $tenant; 'x-user-id' = $user; 'x-user-role' = $role }
  Invoke-RestMethod -Method Post -Uri "$baseUrl$query" -Headers $headers -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 10)
}
function Assert-Equal($actual, $expected, $name) {
  if ($actual -ne $expected) { throw "$name expected $expected but got $actual" }
  Write-Host "PASS $name"
}
function Assert-BadRequest($tenant, $user, $role, $body, $name, $query = '') {
  try { Invoke-Query $tenant $user $role $body $query | Out-Null; throw "$name expected HTTP 400" }
  catch { if ($_.Exception.Response.StatusCode.value__ -ne 400) { throw } }
  Write-Host "PASS $name"
}

Assert-Equal (Invoke-Query $tenantA $ownerA owner @{ }).meta.totalRecords 5 'Tenant A empty filters'
Assert-Equal (Invoke-Query $tenantA $adminA admin @{ }).meta.totalRecords 5 'Admin visibility'
Assert-Equal (Invoke-Query $tenantA $managerA manager @{ }).meta.totalRecords 5 'Manager visibility'
Assert-Equal (Invoke-Query $tenantA $agentA1 agent @{ }).meta.totalRecords 2 'Agent A1 visibility'
Assert-Equal (Invoke-Query $tenantB $ownerB owner @{ }).meta.totalRecords 2 'Tenant B isolation'
Assert-Equal (Invoke-Query $tenantA $ownerA owner @{ filters = @(@{ fieldId = $city; fieldType = 'string'; condition = 'contain'; value = 'Chennai' }, @{ fieldId = 'assignedTo'; fieldType = 'string'; condition = 'is'; value = $agentA2 }) }).meta.totalRecords 2 'City and Agent A2'
Assert-Equal (Invoke-Query $tenantA $ownerA owner @{ logic = 'OR'; filters = @(@{ fieldId = 'name'; fieldType = 'string'; condition = 'contain'; value = 'Ram' }, @{ fieldId = 'name'; fieldType = 'string'; condition = 'contain'; value = 'Sita' }) }).meta.totalRecords 3 'OR filter'
Assert-Equal (Invoke-Query $tenantA $ownerA owner @{ q = '9000000001' }).meta.totalRecords 1 'Phone search'
Assert-Equal (Invoke-Query $tenantA $ownerA owner @{ filters = @(@{ fieldId = 'assignedTo'; fieldType = 'string'; condition = 'contain'; value = "$agentA1,$agentA2" }) }).meta.totalRecords 4 'Agent multiselect'
Assert-Equal (Invoke-Query $tenantA $ownerA owner @{ filters = @(@{ fieldId = $score; fieldType = 'number'; condition = 'greater than'; value = 9 }) }).meta.totalRecords 2 'Numeric greater-than'
Assert-Equal (Invoke-Query $tenantA $ownerA owner @{ filters = @(@{ fieldId = $score; fieldType = 'number'; condition = 'less than'; value = 9 }) }).meta.totalRecords 2 'Numeric less-than'
Assert-Equal (Invoke-Query $tenantA $ownerA owner @{ filters = @(@{ fieldId = $date; fieldType = 'date'; condition = 'before'; value = '2026-07-01' }) }).meta.totalRecords 1 'Date before'
Assert-Equal (Invoke-Query $tenantA $ownerA owner @{ filters = @(@{ fieldId = $date; fieldType = 'date'; condition = 'after'; value = '2026-08-01' }) }).meta.totalRecords 2 'Date after'
Assert-Equal (Invoke-Query $tenantA $ownerA owner @{ filters = @(@{ fieldId = $qualified; fieldType = 'boolean'; condition = 'is true' }) }).meta.totalRecords 3 'Boolean true'
Assert-Equal (Invoke-Query $tenantA $ownerA owner @{ filters = @(@{ fieldId = $qualified; fieldType = 'boolean'; condition = 'is false' }) }).meta.totalRecords 2 'Boolean false'
Assert-Equal (Invoke-Query $tenantA $ownerA owner @{ } '?limit=2&page=2').meta.totalRecords 5 'Pagination total'
Assert-Equal (Invoke-Query $tenantA $ownerA owner @{ } '?limit=2&page=2').data.Count 2 'Pagination page size'
Assert-BadRequest $tenantA $ownerA owner @{ filters = @(@{ fieldId = 'name'; fieldType = 'string'; condition = 'greater than'; value = 'x' }) } 'Invalid operator'
Assert-BadRequest $tenantA $ownerA owner @{ filters = @(@{ fieldId = $date; fieldType = 'date'; condition = 'is'; value = '2026-99-99' }) } 'Invalid date'
Assert-BadRequest $tenantB $ownerB owner @{ filters = @(@{ fieldId = $city; fieldType = 'string'; condition = 'contain'; value = 'Chennai' }) } 'Cross-tenant custom field'
Assert-BadRequest $tenantA $ownerA owner @{ } 'Invalid sort field' '?sortBy=invalid'
Assert-BadRequest $tenantA $ownerA owner @{ } 'Invalid sort direction' '?sortDirection=invalid'
Assert-BadRequest $tenantA $ownerA owner @{ } 'Invalid page' '?page=0'
Assert-BadRequest $tenantA $ownerA owner @{ } 'Invalid limit' '?limit=101'

try { Invoke-RestMethod -Method Post -Uri $baseUrl -ContentType 'application/json' -Body '{}' | Out-Null; throw 'Missing auth expected HTTP 401' }
catch { if ($_.Exception.Response.StatusCode.value__ -ne 401) { throw } }
Write-Host 'PASS Missing authentication'

try {
  Invoke-RestMethod -Method Post -Uri $baseUrl -Headers @{ 'x-tenant-id' = 'invalid'; 'x-user-id' = $ownerA; 'x-user-role' = 'owner' } -ContentType 'application/json' -Body '{}' | Out-Null
  throw 'Invalid UUID expected HTTP 400'
} catch { if ($_.Exception.Response.StatusCode.value__ -ne 400) { throw } }
Write-Host 'PASS Invalid auth UUID'

Write-Host 'Acceptance suite completed successfully.'
