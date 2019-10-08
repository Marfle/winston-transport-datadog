# winston-transport-datadog

[![npm (scoped)](https://img.shields.io/npm/v/@marfle/winston-transport-datadog.svg)](https://www.npmjs.com/package/@marfle/winston-transport-datadog)

[`winston`](https://github.com/winstonjs/winston) transport for Datadog logging.

There are couple of winston transports for datadog. This one does buffering, error handling and uses tls-tcp instead of https.

## Install

```bash
npm install @marfle/winston-transport-datadog
```

## Usage

Use:

```javascript
const { createLogger } = require('winston');
const { DatadogTransport } = require('@marfle/winston-transport-datadog');

logger = createLogger({
  transports: [
    new DatadogTransport({
      apiKey: '<YOUR API KEY',
      // optional metadata which will be merged with log message
      metadata: {
        environment: process.env.NODE_ENV,
        service: 'myService'
      }
    })
  ]
});
```

## Options

| Name                | Default                       | Description                                                                                        |
| ------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------- |
| `apiKey`            | `undefined`                   | api key from datadog                                                                               |
| `host`              | `'intake.logs.datadoghq.com'` | intake hostname                                                                                    |
| `port`              | `10516`                       | intake port                                                                                        |
| `bufferSize`        | `10000`                       | how many messages to buffer before discarding                                                      |
| `reconnectInterval` | `10000`                       |                                                                                                    |
| `socketOptions`     | `{ timeout: 10000 }`          | options passed to [`tls.socket`](https://nodejs.org/api/tls.html#tls_tls_connect_options_callback) |
| `metadata`          | `{ ddsource: 'winston' }`     | optional metadata which will be merged with log message                                            |

DatadogTransport extends Transport from [`winston-transport`](https://github.com/winstonjs/winston-transport), so it's options also apply.

## License

MIT
See [LICENSE](LICENSE) file.

## About us

[Marfle](https://www.marfle.com) makes software for workboat fleets
