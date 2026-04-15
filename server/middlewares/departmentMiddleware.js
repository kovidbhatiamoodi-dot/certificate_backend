/**
 * Department access middleware.
 * Superadmin bypasses all checks.
 * Regular admins can only access resources belonging to their department.
 * 
 * This middleware checks the resource's department_id against the admin's.
 * It reads department_id from: req.body, req.params, or req.query.
 */
const departmentMiddleware = (req, res, next) => {
  const admin = req.admin;

  // Superadmin → full access
  if (admin.role === "superadmin") {
    return next();
  }

  // For regular admins, get the department_id from request
  const requestDeptId =
    parseInt(req.body?.department_id) ||
    parseInt(req.params?.department_id) ||
    parseInt(req.query?.department_id);

  // If no department_id in request, the controller will use admin's own department
  // So this check only fires when explicitly accessing another department
  if (requestDeptId && admin.department_id !== requestDeptId) {
    return res.status(403).json({
      message: "Access denied: you can only manage your own department",
    });
  }

  next();
};

module.exports = departmentMiddleware;