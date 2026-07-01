export class Container {
  private items = new Map<string, unknown>();

  register<T>(key: string, service: T) {
    this.items.set(key, service);
  }

  resolve<T>(key: string): T {
    return this.items.get(key) as T;
  }
}
