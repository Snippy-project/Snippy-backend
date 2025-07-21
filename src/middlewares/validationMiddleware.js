const handleValidationError = (error, res) => {
  const formattedErrors = error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message
  }));

  res.status(400).json({
    success: false,
    message: '資料驗證失敗',
    errors: formattedErrors
  });
};

const createValidationMiddleware = (schema) => {
  return (req, res, next) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      handleValidationError(error, res);
    }
  };
};

const validateRequired = (fields) => {
  return (req, res, next) => {
    const missingFields = [];
    
    for (const field of fields) {
      if (!req.body[field]) {
        missingFields.push(field);
      }
    }
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: '缺少必要欄位',
        missingFields
      });
    }
    
    next();
  };
};

export { 
  createValidationMiddleware,
  validateRequired
};