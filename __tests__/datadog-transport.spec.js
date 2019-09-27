"use strict";
const tls = require("tls");
jest.mock("tls");
const EventEmitter = require("events");
const { createLogger } = require("winston");
const DatadogTransport = require("../datadog-transport");

describe("winston-transport-datadog", () => {
  let logCallback;
  let transport;
  let socket;
  beforeEach(() => {
    socket = new EventEmitter();
    socket.authorized = true;
    socket.write = jest.fn().mockImplementation(() => true);
    socket.destroy = jest.fn();
    tls.connect = jest.fn().mockImplementation(() => socket);

    logCallback = jest.fn();
    transport = new DatadogTransport({
      host: "testhost",
      port: 1234,
      reconnectInterval: 0
    });
  });

  it("merges configuration correctly", () => {
    const transport = new DatadogTransport({
      host: "testhost",
      metadata: {
        environment: "production",
        hostname: "production.foo.bar",
        service: "testService"
      },
      socketOptions: {
        rejectUnauthorized: false
      }
    });
    expect(transport.config).toBeDefined();
    expect(transport.config).toEqual({
      host: "testhost",
      port: 10516,
      bufferSize: 10000,
      reconnectInterval: 10000,
      metadata: {
        ddsource: "winston",
        environment: "production",
        hostname: "production.foo.bar",
        service: "testService"
      },
      socketOptions: {
        timeout: 10000,
        rejectUnauthorized: false
      }
    });
  });

  it("tries to connect socket on first message", () => {
    expect(tls.connect).not.toHaveBeenCalled();
    transport.log({}, logCallback);
    expect(tls.connect).toHaveBeenCalledTimes(1);
  });

  it("does not send over unauthorized socket", () => {
    socket.authorized = false;
    transport.log({}, logCallback);
    expect(tls.connect).toHaveBeenCalledTimes(1);
    socket.emit("secureConnect");
    expect(socket.destroy).toHaveBeenCalled();
    expect(transport.queue.paused).toBe(true);
  });

  it("buffers log message before sending", () => {
    transport.log({}, logCallback);
    expect(transport.queue.length()).toBe(1);
    expect(transport.queue.paused).toBe(true);
    expect(socket.write).not.toHaveBeenCalled();
    socket.emit("secureConnect");
    expect(transport.queue.paused).toBe(false);
  });

  it("pauses sending after socket error", () => {
    transport.log({}, logCallback);
    socket.emit("secureConnect");
    expect(transport.queue.paused).toBe(false);
    socket.emit("error");
    expect(transport.queue.paused).toBe(true);
  });

  it("pauses sending after socket timeout", () => {
    transport.log({}, logCallback);
    socket.emit("secureConnect");
    expect(transport.queue.paused).toBe(false);
    socket.emit("timeout");
    expect(transport.queue.paused).toBe(true);
  });

  it("drains queue after socket connect", async () => {
    transport.log({}, logCallback);
    transport.log({}, logCallback);
    transport.log({}, logCallback);
    expect(transport.queue.length()).toBe(3);
    socket.emit("secureConnect");
    expect(transport.queue.paused).toBe(false);
    await transport.queue.drain();
    expect(transport.queue.length()).toBe(0);
  });
  it("reconnects after reconnectInterval if queue has messages", () => {
    jest.useFakeTimers();
    transport = new DatadogTransport({ reconnectInterval: 2 });
    transport.log({}, logCallback);
    transport.log({}, logCallback);
    transport.log({}, logCallback);
    expect(transport.queue.length()).toBe(3);
    tls.connect.mockClear();
    socket.emit("error");
    expect(socket.destroy).toHaveBeenCalled();
    expect(transport.reconnectTimeout).toBeDefined();

    jest.advanceTimersByTime(1);
    expect(tls.connect).toHaveBeenCalledTimes(0);
    jest.advanceTimersByTime(1);
    expect(tls.connect).toHaveBeenCalledTimes(1);
  });
  it("integrates with winston", async () => {
    const transports = [transport];
    const logger = createLogger({
      transports
    });
    transport.queue.push = jest.fn();
    logger.error("testmessage");

    expect(transport.queue.push).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "error",
        message: "testmessage"
      })
    );
  });
});
