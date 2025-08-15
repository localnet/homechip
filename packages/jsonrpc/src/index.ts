export { default as JsonrpcError } from "./jsonrpc-error.ts";
export type { RouteMap, RouteMethod } from "./peer-request.ts";
export { default as SocketClient } from "./socket-client.ts";
export type { default as SocketPeer } from "./socket-peer.ts";
export { default as SocketServer } from "./socket-server.ts";

export type JsonrpcId = string | number;

export interface JsonrpcVersion {
    jsonrpc: "2.0";
}

export interface JsonrpcRequest extends JsonrpcVersion {
    id?: JsonrpcId;
    method: string;
    params?: unknown[];
}

export interface JsonrpcSuccess extends JsonrpcVersion {
    id: JsonrpcId;
    result: unknown;
}

export interface JsonrpcFailure extends JsonrpcVersion {
    id: JsonrpcId | null;
    error: {
        code: number;
        message: string;
        data?: unknown;
    };
}

export type JsonrpcResponse = JsonrpcSuccess | JsonrpcFailure;
export type JsonrpcMessage = JsonrpcRequest | JsonrpcResponse;
