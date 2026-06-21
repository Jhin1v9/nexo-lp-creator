/**
 * Luna Extension Event Handler for NEXO Landing Page Creator
 *
 * Receives DOM/streaming events from the Luna Chrome Extension
 * (loaded by the Kimi bridge) and buffers them for the bridge
 * to consume via global.__lunaExtensionEventBuffers.
 *
 * Also supports server-to-extension messaging via /ext/poll.
 *
 * @module services/luna/lunaExtensionHandler
 * @version 1.0.0
 */

const MAX_EVENTS_PER_SESSION = 5000;
const MAX_MESSAGES_PER_SESSION = 500;

// global buffers used by kimii-bridge.cjs _consumeExtensionEvents()
if (!global.__lunaExtensionEventBuffers) {
  global.__lunaExtensionEventBuffers = new Map();
}
const eventBuffers = global.__lunaExtensionEventBuffers;

// server -> extension outbound message queues
if (!global.__lunaExtensionOutboundQueues) {
  global.__lunaExtensionOutboundQueues = new Map();
}
const outboundQueues = global.__lunaExtensionOutboundQueues;

/**
 * Register a new extension session.
 * @param {string} sessionId
 */
function registerSession(sessionId) {
  if (!sessionId) return false;
  if (!eventBuffers.has(sessionId)) {
    eventBuffers.set(sessionId, []);
  }
  if (!outboundQueues.has(sessionId)) {
    outboundQueues.set(sessionId, []);
  }
  return true;
}

/**
 * Push an event from the extension into the global buffer.
 * @param {string} sessionId
 * @param {object} event
 */
function pushEvent(sessionId, event) {
  if (!sessionId || !event) return false;
  registerSession(sessionId);
  // Debug visibility — remove once extension integration is stable
  console.log(`[LunaExtHandler] event from ${sessionId}: ${event.eventType || event.type}`);
  const buf = eventBuffers.get(sessionId);
  buf.push({
    ...event,
    bufferedAt: Date.now(),
  });
  // prevent unbounded growth
  if (buf.length > MAX_EVENTS_PER_SESSION) {
    buf.splice(0, buf.length - MAX_EVENTS_PER_SESSION);
  }
  return true;
}

/**
 * Consume all buffered events for a session.
 * @param {string} sessionId
 * @returns {Array}
 */
function consumeEvents(sessionId) {
  if (!sessionId) return [];
  const buf = eventBuffers.get(sessionId);
  if (!buf || buf.length === 0) return [];
  const events = buf.splice(0, buf.length);
  return events;
}

/**
 * Queue a message to be sent to the extension.
 * @param {string} sessionId
 * @param {object} message
 */
function pushOutboundMessage(sessionId, message) {
  if (!sessionId || !message) return false;
  registerSession(sessionId);
  const queue = outboundQueues.get(sessionId);
  queue.push({
    ...message,
    queuedAt: Date.now(),
  });
  if (queue.length > MAX_MESSAGES_PER_SESSION) {
    queue.splice(0, queue.length - MAX_MESSAGES_PER_SESSION);
  }
  return true;
}

/**
 * Consume all queued outbound messages for a session.
 * @param {string} sessionId
 * @returns {Array}
 */
function consumeOutboundMessages(sessionId) {
  if (!sessionId) return [];
  const queue = outboundQueues.get(sessionId);
  if (!queue || queue.length === 0) return [];
  return queue.splice(0, queue.length);
}

/**
 * Clean up a session when the extension disconnects.
 * @param {string} sessionId
 */
function unregisterSession(sessionId) {
  if (!sessionId) return;
  eventBuffers.delete(sessionId);
  outboundQueues.delete(sessionId);
}

module.exports = {
  registerSession,
  pushEvent,
  consumeEvents,
  pushOutboundMessage,
  consumeOutboundMessages,
  unregisterSession,
};
