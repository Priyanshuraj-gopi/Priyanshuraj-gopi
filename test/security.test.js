const test = require('node:test');
const assert = require('node:assert/strict');

const { hasEmployeeAccess, getRole } = require('../src/security');

test('reads role from headers', () => {
  const role = getRole({ headers: { 'x-role': 'EMPLOYEE' } });
  assert.equal(role, 'employee');
});

test('allows employee access only with valid token', () => {
  const allowed = hasEmployeeAccess(
    { headers: { 'x-role': 'employee', 'x-employee-token': 'secret' } },
    'secret',
  );
  const denied = hasEmployeeAccess(
    { headers: { 'x-role': 'employee', 'x-employee-token': 'wrong' } },
    'secret',
  );

  assert.equal(allowed, true);
  assert.equal(denied, false);
});
