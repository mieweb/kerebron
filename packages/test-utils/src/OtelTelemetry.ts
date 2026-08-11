import { trace, Tracer } from '@opentelemetry/api';
import { Logger, logs } from '@opentelemetry/api-logs';

import { Telemetry } from '@kerebron/editor/Telemetry';

export class OtelTelemetry implements Telemetry {
  enabled = true;
  tracer: Tracer;
  logger: Logger;

  constructor(tracerName: string) {
    this.tracer = trace.getTracer(tracerName);
    this.logger = logs.getLogger(tracerName);
  }

  async span<T>(
    name: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return await this.tracer.startActiveSpan(
      name,
      async (span) => {
        try {
          return await fn();
        } catch (e) {
          span.recordException(e as Error);
          throw e;
        } finally {
          span.end();
        }
      },
    );
  }

  event(type: string, data: unknown) {
    const span = trace.getActiveSpan();

    span?.addEvent(type, {
      'debug.json': JSON.stringify(data),
    });
  }

  log(type: string, body: any) {
    this.logger.emit({
      body,
      attributes: {
        'debug.type': type,
      },
    });
  }
}
