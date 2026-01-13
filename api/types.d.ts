/// <reference types="node" />

declare module '@vercel/node' {
  import type { IncomingMessage, ServerResponse } from 'http';

  export interface VercelRequest extends IncomingMessage {
    query?: Record<string, any>;
    body?: any;
    cookies?: Record<string, string>;
  }

  export interface VercelResponse extends ServerResponse {
    status: (code: number) => VercelResponse;
    json: (body: any) => void;
    send: (body: any) => void;
  }
}

declare module 'busboy' {
  import type { IncomingHttpHeaders } from 'http';
  import type { Readable, Writable } from 'stream';

  export interface FileInfo {
    filename: string;
    mimeType: string;
    encoding: string;
    fieldname?: string;
  }

  export interface BusboyConfig {
    headers: IncomingHttpHeaders;
  }

  export interface BusboyInstance extends Writable {
    on(event: 'file', cb: (name: string, file: Readable, info: FileInfo) => void): this;
    on(event: 'field', cb: (name: string, value: any, info: any) => void): this;
    on(event: 'finish', cb: () => void): this;
    on(event: 'error', cb: (err: any) => void): this;
    on(event: string, cb: (...args: any[]) => void): this;
    end(chunk?: any): this;
  }

  function Busboy(config: BusboyConfig): BusboyInstance;
  export = Busboy;
  export default Busboy;
}
