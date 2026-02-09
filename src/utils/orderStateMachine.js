/**
 * Order State Machine
 * Manages the order lifecycle and validates state transitions
 * Ensures orders follow a logical progression through states
 */

const { ORDER_STATUS } = require("../models/Orders");

const ORDER_STATES = {
  WAITING_FOR_APPROVAL: ORDER_STATUS.WAITING_FOR_APPROVAL,
  APPROVED_PREPARING: ORDER_STATUS.APPROVED_PREPARING,
  READY_FOR_DELIVERY: ORDER_STATUS.READY_FOR_DELIVERY,
  ON_THE_WAY: ORDER_STATUS.ON_THE_WAY,
  DELIVERED: ORDER_STATUS.DELIVERED,
  CANCELED: ORDER_STATUS.CANCELED
};

// Valid state transitions - defines which states can transition to which states
const VALID_TRANSITIONS = {
  [ORDER_STATES.WAITING_FOR_APPROVAL]: [
    ORDER_STATES.APPROVED_PREPARING,
    ORDER_STATES.CANCELED
  ],
  [ORDER_STATES.APPROVED_PREPARING]: [
    ORDER_STATES.READY_FOR_DELIVERY,
    ORDER_STATES.CANCELED
  ],
  [ORDER_STATES.READY_FOR_DELIVERY]: [
    ORDER_STATUS.ACCEPTED, // Agent accepted
    ORDER_STATES.ON_THE_WAY, // Direct transition fallback
    ORDER_STATES.CANCELED
  ],
  [ORDER_STATUS.ACCEPTED]: [
    ORDER_STATES.ON_THE_WAY,
    ORDER_STATES.CANCELED
  ],
  [ORDER_STATES.ON_THE_WAY]: [
    ORDER_STATES.DELIVERED,
    ORDER_STATES.CANCELED
  ],
  [ORDER_STATES.DELIVERED]: [],
  [ORDER_STATES.CANCELED]: []
};

// Order states that allow cancellation
const CANCELABLE_STATES = [
  ORDER_STATES.WAITING_FOR_APPROVAL,
  ORDER_STATES.APPROVED_PREPARING,
  ORDER_STATES.READY_FOR_DELIVERY,
  ORDER_STATUS.ACCEPTED,
  ORDER_STATES.ON_THE_WAY
];

// Final states (no further transitions possible)
const FINAL_STATES = [
  ORDER_STATES.DELIVERED,
  ORDER_STATES.CANCELED
];

/**
 * Validates if a state transition is allowed
 * @param {string} currentState - Current order state
 * @param {string} nextState - Next order state
 * @returns {boolean} - True if transition is valid, false otherwise
 */
function isValidTransition(currentState, nextState) {
  if (!VALID_TRANSITIONS[currentState]) {
    console.warn(`[OrderStateMachine] Unknown current state: ${currentState}`);
    return false;
  }
  return VALID_TRANSITIONS[currentState].includes(nextState);
}

/**
 * Gets available next states for a given current state
 * @param {string} currentState - Current order state
 * @returns {array} - Array of valid next states
 */
function getAvailableTransitions(currentState) {
  return VALID_TRANSITIONS[currentState] || [];
}

/**
 * Creates a status timeline entry
 * @param {string} status - The status being recorded
 * @param {string} note - Optional note about the status change
 * @param {string} updatedBy - ID of who made the change
 * @returns {object} - Timeline entry object
 */
function createStatusTimelineEntry(status, note = '', updatedBy = null) {
  return {
    status,
    timestamp: new Date(),
    note,
    updated_by: updatedBy
  };
}

/**
 * Validates order cancellation eligibility
 * @param {string} currentState - Current order state
 * @returns {object} - {canCancel: boolean, reason: string}
 */
function canCancelOrder(currentState) {
  const canCancel = CANCELABLE_STATES.includes(currentState);

  return {
    canCancel,
    reason: !canCancel
      ? `Cannot cancel order in ${currentState} state. Order has already been ${currentState === ORDER_STATES.DELIVERED ? 'delivered' : 'is in final state'}`
      : ''
  };
}

/**
 * Gets order completion status
 * @param {string} currentState - Current order state
 * @returns {boolean} - True if order is in a final state
 */
function isOrderComplete(currentState) {
  return FINAL_STATES.includes(currentState);
}

/**
 * Validates state machine integrity
 * Ensures all transitions are defined consistently
 */
function validateStateMachine() {
  const allStates = Object.values(ORDER_STATES);

  // Check that all states in VALID_TRANSITIONS exist
  for (const state of Object.keys(VALID_TRANSITIONS)) {
    if (!allStates.includes(state)) {
      console.error(`[OrderStateMachine] Invalid state in VALID_TRANSITIONS: ${state}`);
      return false;
    }

    // Check that all target states exist
    for (const targetState of VALID_TRANSITIONS[state]) {
      if (!allStates.includes(targetState)) {
        console.error(`[OrderStateMachine] Invalid target state: ${targetState} from ${state}`);
        return false;
      }
    }
  }

  return true;
}

// Validate state machine on module load
if (!validateStateMachine()) {
  console.error('[OrderStateMachine] State machine validation FAILED');
}

/**
 * Gets a human-readable status description
 */
function getStatusDescription(state) {
  const descriptions = {
    [ORDER_STATES.WAITING_FOR_APPROVAL]: 'Waiting for restaurant approval',
    [ORDER_STATES.APPROVED_PREPARING]: 'Restaurant is preparing your order',
    [ORDER_STATES.APPROVED_PREPARING]: 'Restaurant is preparing your order',
    [ORDER_STATES.READY_FOR_DELIVERY]: 'Your order is ready for pickup',
    [ORDER_STATUS.ACCEPTED]: 'Delivery agent has accepted your order',
    [ORDER_STATES.ON_THE_WAY]: 'Your order is on the way',
    [ORDER_STATES.DELIVERED]: 'Your order has been delivered',
    [ORDER_STATES.CANCELED]: 'Your order has been canceled'
  };

  return descriptions[state] || 'Unknown status';
}

module.exports = {
  ORDER_STATES,
  VALID_TRANSITIONS,
  CANCELABLE_STATES,
  FINAL_STATES,
  isValidTransition,
  getAvailableTransitions,
  createStatusTimelineEntry,
  canCancelOrder,
  isOrderComplete,
  validateStateMachine,
  getStatusDescription
};
