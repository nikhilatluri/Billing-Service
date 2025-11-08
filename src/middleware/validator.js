const Joi = require('joi');
const { AppError } = require('./errorHandler');

const schemas = {
  generateBill: Joi.object({
    appointment_id: Joi.number().integer().positive().required(),
    patient_id: Joi.number().integer().positive().required(),
    doctor_id: Joi.number().integer().positive().required(),
    amount: Joi.number().positive().precision(2).required(),
    bill_type: Joi.string().valid('CONSULTATION', 'NO_SHOW_FEE', 'CANCELLATION_FEE').optional()
  }),

  handleCancellation: Joi.object({
    appointment_id: Joi.number().integer().positive().required(),
    refund_policy: Joi.string().valid('FULL_REFUND', 'PARTIAL_REFUND', 'CANCELLATION_FEE', 'NO_REFUND').required()
  }),

  markPaid: Joi.object({
    payment_id: Joi.number().integer().positive().required()
  }),

  searchQuery: Joi.object({
    patient_id: Joi.number().integer().positive(),
    status: Joi.string().valid('OPEN', 'PAID', 'VOID', 'REFUND'),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10)
  })
};

const validate = (schemaName) => {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) {
      return next(new AppError('Validation schema not found', 500));
    }

    const dataToValidate = req.method === 'GET' ? req.query : req.body;
    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const message = error.details.map(detail => detail.message).join(', ');
      return next(new AppError(message, 400, 'VALIDATION_ERROR'));
    }

    if (req.method === 'GET') {
      req.query = value;
    } else {
      req.body = value;
    }

    next();
  };
};

module.exports = { validate };
