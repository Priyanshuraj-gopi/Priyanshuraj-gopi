function getRole(req) {
  const roleHeader = req.headers['x-role'];
  if (!roleHeader) {
    return null;
  }
  return String(roleHeader).toLowerCase();
}

function hasEmployeeAccess(req, expectedToken) {
  const role = getRole(req);
  const token = req.headers['x-employee-token'];
  return role === 'employee' && token === expectedToken;
}

function requireCustomer(req, res, next) {
  const role = getRole(req);
  if (role !== 'customer') {
    return res.status(403).json({ error: 'Customer role required' });
  }
  return next();
}

function requireEmployee(expectedToken) {
  return (req, res, next) => {
    if (!hasEmployeeAccess(req, expectedToken)) {
      return res.status(403).json({ error: 'Employee role and valid token required' });
    }
    return next();
  };
}

module.exports = {
  getRole,
  hasEmployeeAccess,
  requireCustomer,
  requireEmployee,
};
