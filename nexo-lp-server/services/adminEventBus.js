/**
 * NEXO Landing Page Creator v3.0 - Admin Event Bus
 *
 * In-memory event bus with a small ring buffer used to stream
 * operational events to the admin Command Center via SSE.
 *
 * @module services/adminEventBus
 * @version 3.0.0
 */

const { EventEmitter } = require('events');

const BUFFER_SIZE = 50;

class AdminEventBus extends EventEmitter {
  constructor() {
    super();
    this.buffer = [];
  }

  /**
   * Publish an event to all listeners and keep it in the recent buffer.
   * @param {object} event
   */
  publish(event) {
    const enriched = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
    };
    this.buffer.push(enriched);
    if (this.buffer.length > BUFFER_SIZE) {
      this.buffer.shift();
    }
    this.emit('event', enriched);
  }

  /**
   * Return a copy of the buffered events.
   * @returns {object[]}
   */
  getRecent() {
    return [...this.buffer];
  }
}

module.exports = new AdminEventBus();
