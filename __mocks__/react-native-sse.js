class EventSource {
  constructor() {
    this.listeners = {};
  }

  addEventListener(event, listener) {
    (this.listeners[event] ??= []).push(listener);
  }

  removeAllEventListeners() {
    this.listeners = {};
  }

  close() {}
}

module.exports = EventSource;
module.exports.default = EventSource;
