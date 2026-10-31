import { JupyterWebSocketTransport } from './JupyterWebSocketTransport.ts';

class Request<Result> {
  declare resolve: (result: Result) => void;
  declare reject: (error: any) => void;
  promise: Promise<Result>;

  constructor(
    readonly id: number,
    readonly params: any,
    readonly timeout: ReturnType<typeof setTimeout>,
  ) {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

export class JupyterClient extends EventTarget {
  private readonly timeout: number = 10_000;

  private nextReqID = 0;
  private requests: Request<any>[] = [];
  private active = false;

  private readonly receiveListener: EventListenerOrEventListenerObject;
  private readonly startKernelListener: EventListenerOrEventListenerObject;

  constructor(private transport: JupyterWebSocketTransport) {
    super();

    this.receiveListener = (event) => this.receiveMessage(event);
    this.startKernelListener = (event) =>
      this.request({
        op: 'start',
      });

    this.transport.addEventListener('message', this.receiveListener);
    this.transport.addEventListener('close', (event) => {
      this.active = false;
      // this.dispatchEvent(new CloseEvent('close'));
    });
  }

  private receiveMessage(event: Event) {
    const msg = (event as MessageEvent).data;

    const value = JSON.parse(msg);

    console.log('receiveMessage', value);

    if ('id' in value && ('progress' in value)) {
      console.info('jupyter.progress', value.progress);
      return;
    }

    if ('id' in value && !('op' in value)) {
      const index = this.requests.findIndex((r) => r.id == value.id);
      if (index < 0) {
        console.warn(
          `[lsp] Received a response for non-existent request ${value.id}`,
        );
      } else {
        const req = this.requests[index];
        clearTimeout(req.timeout);
        this.requests.splice(index, 1);

        console.log('value.result', value);

        if (value.error) req.reject(new Error(value.error));
        else req.resolve(value.result);
      }
    } else if (!('id' in value)) {
      const event = new CustomEvent(value.method, {
        detail: { params: value.params },
      });
    } else {
      // const resp: lsp.ResponseMessage = {
      //   jsonrpc: '2.0',
      //   id: value.id,
      //   error: {
      //     code: -32601, /* MethodNotFound */
      //     message: 'Method not implemented',
      //   },
      // };
      // this.transport.send(JSON.stringify(resp));
    }
  }

  async request<Params, Result>(
    payload: Parameters<typeof this.requestInner>[0],
  ): Promise<Result> {
    if (!this.transport.isConnected()) {
      if (this.active) {
        this.transport.connect();
      }
      throw new Error('Not connected');
    }

    const retVal = await this.requestInner<Params, Result>(payload)
      .promise;
    return retVal;
  }

  private requestInner<Params, Result>(
    payload: any,
  ): Request<Result> {
    if (!this.transport) {
      throw new Error('No transport');
    }
    if (!this.transport.isConnected()) {
      if (this.active) {
        this.transport.connect();
      }
      throw new Error('Transport not connected');
    }

    const id = ++this.nextReqID;
    const data = {
      id,
      timeoutMs: this.timeout,
      ...payload,
    };

    const req = new Request<Result>(
      id,
      payload,
      setTimeout(
        () => this.timeoutRequest(req, id, payload),
        this.timeout,
      ),
    );

    try {
      if (!this.transport) {
        throw new Error('No transport');
      }
      this.transport.send(JSON.stringify(data));
      this.requests.push(req);
    } catch (e) {
      console.error(e);
      clearTimeout(req.timeout);
      req.reject(e);
    }
    return req;
  }

  private timeoutRequest<T>(
    req: Request<T>,
    id: number,
    payload: any,
  ) {
    const index = this.requests.indexOf(req);
    if (index > -1) {
      req.reject(new Error('Yupyer Timeout', { cause: payload }));
      this.requests.splice(index, 1);
    }
  }

  destroy() {
    this.transport.removeEventListener('message', this.receiveListener);
    this.transport.removeEventListener('open', this.startKernelListener);
  }
}
