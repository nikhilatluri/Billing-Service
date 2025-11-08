const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Billing Service API',
      version: '1.0.0',
      description: 'Hospital Management System - Billing Service API Documentation',
    },
    servers: [{ url: 'http://localhost:3004', description: 'Development server' }],
    components: {
      schemas: {
        Error: {
          type: 'object',
          properties: {
            code: { type: 'string', example: 'BILL_NOT_FOUND' },
            message: { type: 'string', example: 'Bill not found' },
            correlationId: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  },
  apis: ['./src/routes/*.js'],
};

module.exports = swaggerJsdoc(options);
