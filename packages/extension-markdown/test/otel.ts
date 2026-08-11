import { NodeTracerProvider } from 'npm:@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor } from 'npm:@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from 'npm:@opentelemetry/exporter-trace-otlp-proto';

// http://localhost:5080/web/ingestion/recommended/traces?org_identifier=default
const exporter = new OTLPTraceExporter({
  url: 'http://localhost:5080/api/default',
  headers: {
    Authorization:
      'Basic cm9vdEBleGFtcGxlLmNvbTpvMm9pX05FZlJIclE1VnhFODJsWDhSS0tackVRZWVsd1VVaUtL',
    organization: 'default',
    'stream-name': 'default',
  },
});

const provider = new NodeTracerProvider({
  spanProcessors: [
    new SimpleSpanProcessor(exporter),
  ],
});

provider.register();

import { logs } from '@opentelemetry/api-logs';
import {
  LoggerProvider,
  SimpleLogRecordProcessor,
} from 'npm:@opentelemetry/sdk-logs';
import { OTLPLogExporter } from 'npm:@opentelemetry/exporter-logs-otlp-proto';

{
  const exporter = new OTLPLogExporter({
    // url: 'http://localhost:5080/api/default/v1/logs',
    url: 'http://localhost:5080/api/default',
    headers: {
      Authorization:
        'Basic cm9vdEBleGFtcGxlLmNvbTpvMm9pX05FZlJIclE1VnhFODJsWDhSS0tackVRZWVsd1VVaUtL',
      organization: 'default',
      'stream-name': 'default',
    },
  });

  const loggerProvider = new LoggerProvider({
    processors: [
      new SimpleLogRecordProcessor({ exporter }),
    ],
  });

  logs.setGlobalLoggerProvider(loggerProvider);
}

// const otelLogger = logs.getLogger("pipeline");
