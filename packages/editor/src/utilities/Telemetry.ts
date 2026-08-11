export interface Telemetry {
  enabled: boolean;

  span<T>(name: string, fn: () => T): T;
  event(type: string, data: unknown): void;
  log(type: string, body: unknown): void;
}

export class NoTelemetry implements Telemetry {
  enabled = false;

  span<T>(_: string, fn: () => T): T {
    return fn();
  }

  event(): void {
  }

  log(): void {
  }
}
