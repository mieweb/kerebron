import { nodeToTreeString } from '@kerebron/editor';
import { Node } from '@kerebron/pm/model';
import { Telemetry } from '@kerebron/editor/Telemetry';

export class FileTelemetry implements Telemetry {
  enabled = true;

  spans: Array<string> = [];

  map: Record<string, Array<string>> = {};

  constructor(private tracerName: string) {
  }

  span<T>(name: string, fn: () => T): T {
    try {
      this.spans.push(name);
      const result = fn();

      if (result instanceof Promise) {
        return result
          .finally(() => {
            this.spans.pop();
          }) as T;
      }

      return result;
    } catch (e) {
      this.spans.pop();
      throw e;
    }
  }

  event(type: string, data: unknown) {
    const currentSpans: Array<string> = ([] as Array<string>).concat(this.spans)
      .concat([type]);

    for (const [fileName, fileSpans] of Object.entries(this.map)) {
      const lastSpan = fileSpans[fileSpans.length - 1];
      if (currentSpans[currentSpans.length - 1] !== lastSpan) {
        continue;
      }

      let min = 0;
      for (let i = 0; i < fileSpans.length; i++) {
        let idx = currentSpans.findIndex((span, idx) => {
          if (idx < min) {
            return false;
          }

          if (span === fileSpans[i]) {
            return true;
          }

          return false;
        });

        if (idx === -1) {
          min = -1;
          break;
        }

        min = idx + 1;
      }

      if (min === -1) {
        continue;
      }

      const stackTrace = new Error().stack || '';
      const sourceFile = stackTrace.split('\n')[2].replace(/^.*file:\/\//, '')
        .replace(')', '');

      console.info('EVENT', sourceFile, fileName);
      if (data instanceof Node) {
        data = nodeToTreeString(data);
      }
      Deno.writeTextFileSync(
        fileName,
        typeof data === 'string' ? data : JSON.stringify(data, null, 2),
      );
    }
  }

  log(type: string, body: any) {
  }
}
