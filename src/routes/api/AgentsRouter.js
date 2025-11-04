
const router = require("express").Router();
const { checkToken } = require("../../auth/token_validation");
const agentsController = require("../../controllers/AgentsController");

// PUBLIC ROUTES
router.post("/create", agentsController.createAgent); // For creating a new agent account
router.post("/login", agentsController.login);       // For agent login

// ADMIN & AUTHENTICATED ROUTES (assuming checkToken verifies admin or the agent themselves)
router.get("/all", checkToken, agentsController.getAgents); // Get a list of all agents
router.get("/:id/orders", checkToken, agentsController.getOrdersByAgentId); // Get all orders handled by a specific agent
router.put("/toggle_ban/:id", checkToken, agentsController.toggleAgentBan); // Ban or unban an agent

module.exports = router;
