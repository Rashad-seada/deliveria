const request = require('supertest');
const express = require('express');

// We need to initialize an app for testing purposes
// It's often a good practice to export the app from index.js without it listening, 
// and have a separate file to start the server.
// For now, we'll create a simple app instance here.

const app = express();
const router = require('../src/routes/index');
app.use(router);

describe('API Endpoints', () => {

  // Test for a 404 Not Found on a random endpoint
  it('should return 404 for a non-existent route', async () => {
    const res = await request(app)
      .get('/api/non-existent-route-for-testing');
    expect(res.statusCode).toEqual(404);
  });

  // Example test for an existing endpoint (e.g., GET /auth - if it exists and is public)
  // This is commented out as it requires the full app setup and might fail
  // depending on middleware, but serves as an example.
  /*
  it('should return 200 for the auth endpoint', async () => {
    const res = await request(app).get('/auth');
    expect(res.statusCode).toEqual(200);
  });
  */

});

describe('Basic Jest Test', () => {
    it('should confirm that 2 + 2 = 4', () => {
        expect(2 + 2).toBe(4);
    });
});
