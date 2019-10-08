const tls = require('tls');
const Transport = require('winston-transport');
const safeStringify = require('fast-safe-stringify');
const queue = require('async/queue');

const defaultConfig = {
  host: 'intake.logs.datadoghq.com',
  port: 10516,
  bufferSize: 10000,
  reconnectInterval: 10000 // used when transport is idle and there are messages in buffer
};

const defaultSocketOptions = {
  timeout: 10000
};

const defaultMetadata = {
  ddsource: 'winston'
};

module.exports = class DatadogTransport extends Transport {
  constructor(opts) {
    const { socketOptions, metadata, ...restOpts } = opts;
    let config = {
      ...defaultConfig,
      socketOptions: { ...defaultSocketOptions, ...socketOptions },
      metadata: { ...defaultMetadata, ...metadata },
      ...restOpts
    };
    super(config);
    this.config = config;

    this.socketReady = false;
    this.socketErrorHandler = this.socketErrorHandler.bind(this);
    this.socketConnectHandler = this.socketConnectHandler.bind(this);
    this.socketTimeoutHandler = this.socketTimeoutHandler.bind(this);

    this.queue = queue((msg, done) => {
      // Merge the metadata with the log
      const logEntry = { ...this.config.metadata, ...msg };
      const data = `${this.config.apiKey} ${safeStringify(logEntry)}\r\n`;
      if (this.socket.write(data)) {
        done();
      } else {
        this.socket.once('drain', done);
      }
    }, 1);

    this.setMaxListeners(30); // magic number taken from winston console transport

    this.queue.pause();
  }

  connectSocket() {
    if (!this.socket) {
      this.socket = tls
        .connect(this.config.port, this.config.host, this.config.socketOptions)
        .on('secureConnect', this.socketConnectHandler)
        .on('error', this.socketErrorHandler)
        .on('timeout', this.socketTimeoutHandler);
    }
  }

  socketConnectHandler() {
    if (this.socket.authorized) {
      this.socketReady = true;
      this.queue.resume();
    } else {
      this.destroySocket();
    }
  }

  socketTimeoutHandler() {
    this.destroySocket();
    this.queue.pause();
  }

  socketErrorHandler() {
    this.destroySocket();
    this.queue.pause();
  }

  destroySocket() {
    this.socket.destroy();
    this.socket = undefined;
    this.socketReady = false;
    if (
      !this.reconnectTimeout &&
      this.config.reconnectInterval > 0 &&
      this.queue.length() > 0
    ) {
      this.reconnectTimeout = setTimeout(() => {
        this.connectSocket();
        this.reconnectTimeout = null;
      }, this.config.reconnectInterval);
    }
  }

  log(info, callback) {
    setImmediate(() => {
      this.emit('logged', info);
    });
    if (this.queue.length() < this.config.bufferSize) {
      this.queue.push(info);
    }

    callback();

    if (!this.socketReady) {
      this.connectSocket();
    }
  }
};
