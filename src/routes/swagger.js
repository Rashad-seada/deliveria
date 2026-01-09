const express = require('express');
const router = express.Router();
const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const path = require('path');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Deliveria API',
      version: '1.0.0',
      description: 'Auto-generated API documentation (partial). Add JSDoc comments to routes/controllers for full coverage.'
    },
    servers: [
      {
        url: process.env.SWAGGER_BASE_URL || 'http://localhost:8550',
        description: 'Local server'
      }
    ]
  },
  apis: [
    // Scan all JS files under src (controllers, routes, models, etc.)
    path.join(__dirname, '..', '**', '*.js'),
    // Keep an explicit controllers pattern for clarity
    path.join(__dirname, '..', 'controllers', '*.js')
  ]
};

const swaggerSpec = swaggerJSDoc(options);

router.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Expose raw JSON as well
router.get('/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

module.exports = router;
