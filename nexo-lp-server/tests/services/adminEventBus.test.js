const adminEventBus = require('../../services/adminEventBus');

describe('adminEventBus', () => {
  beforeEach(() => {
    adminEventBus.buffer = [];
    adminEventBus.removeAllListeners();
  });

  test('publishes event and keeps buffer', () => {
    const listener = jest.fn();
    adminEventBus.on('event', listener);
    adminEventBus.publish({ type: 'test' });
    expect(listener).toHaveBeenCalled();
    expect(adminEventBus.getRecent().length).toBe(1);
  });

  test('enriches events with a timestamp', () => {
    adminEventBus.publish({ type: 'test' });
    const recent = adminEventBus.getRecent();
    expect(recent[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('drops old events when buffer exceeds BUFFER_SIZE', () => {
    for (let i = 0; i < 55; i += 1) {
      adminEventBus.publish({ type: `event-${i}` });
    }
    expect(adminEventBus.getRecent().length).toBe(50);
    expect(adminEventBus.getRecent()[0].type).toBe('event-5');
  });
});
