import Department from "../models/Department.js";

// @desc    Create a new department
// @route   POST /api/departments
// @access  Admin
export const createDepartment = async (req, res, next) => {
  const { name, description, supportedCategories } = req.body;

  if (!name) {
    const error = new Error("Department name is required");
    error.statusCode = 400;
    return next(error);
  }

  const existing = await Department.findOne({ name });
  if (existing) {
    const error = new Error("Department with this name already exists");
    error.statusCode = 400;
    return next(error);
  }

  const department = await Department.create({
    name,
    description,
    supportedCategories: supportedCategories || []
  });

  res.status(201).json({
    success: true,
    data: department
  });
};

// @desc    Get all active departments
// @route   GET /api/departments
// @access  Public / Application wide
export const getDepartments = async (req, res, next) => {
  const departments = await Department.find({ deleted: false }).sort({ createdAt: -1 });

  res.json({
    success: true,
    data: departments
  });
};

// @desc    Update a department
// @route   PUT /api/departments/:id
// @access  Admin
export const updateDepartment = async (req, res, next) => {
  const { name, description, supportedCategories } = req.body;

  const department = await Department.findById(req.params.id);

  if (!department || department.deleted) {
    const error = new Error("Department not found");
    error.statusCode = 404;
    return next(error);
  }

  department.name = name || department.name;
  department.description = description !== undefined ? description : department.description;
  department.supportedCategories = supportedCategories || department.supportedCategories;

  const updatedDepartment = await department.save();

  res.json({
    success: true,
    data: updatedDepartment
  });
};

// @desc    Soft delete a department
// @route   DELETE /api/departments/:id
// @access  Admin
export const deleteDepartment = async (req, res, next) => {
  const department = await Department.findById(req.params.id);

  if (!department || department.deleted) {
    const error = new Error("Department not found");
    error.statusCode = 404;
    return next(error);
  }

  department.deleted = true;
  await department.save();

  res.json({
    success: true,
    message: "Department deleted successfully"
  });
};
