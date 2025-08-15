import { Socket } from "node:net";
import type { JsonrpcMessage, JsonrpcRequest, JsonrpcResponse } from "./index.ts";
import JsonrpcError from "./jsonrpc-error.ts";
import JsonrpcUtil from "./jsonrpc-util.ts";
import PeerRequest, { type RouteMap } from "./peer-request.ts";
import PeerResponse from "./peer-response.ts";

export type MaybeArray<TJsonrpc extends JsonrpcMessage> = TJsonrpc | TJsonrpc[];
export type MaybeVoid<TJsonrpc extends MaybeArray<JsonrpcMessage>> = void | TJsonrpc | undefined;

export default class SocketPeer {
    static #nul = "\0";

    #data: string;
    #socket: Socket;
    #request: PeerRequest;
    #response: PeerResponse;

    constructor(socket: Socket, router?: RouteMap, timeout?: number) {
        this.#data = "";
        this.#socket = socket;
        this.#request = new PeerRequest(router);
        this.#response = new PeerResponse(timeout);

        this.#socket.setEncoding("utf8");
        this.#socket.on("ready", () => this.#onReady());
        this.#socket.on("drain", () => this.#onDrain());
        this.#socket.on("data", (data) => this.#onData(data));
    }

    async send(request: MaybeArray<JsonrpcRequest>): Promise<MaybeVoid<MaybeArray<JsonrpcResponse>>> {
        this.#writeMessage(request);

        if (request === undefined) {
            return JsonrpcError.parse("Malformed JSON");
        }

        if (!Array.isArray(request)) {
            return this.#response.subscribe(request);
        }

        if (!request.length) {
            return JsonrpcError.request("Empty batch");
        }

        const batch = await Promise.all(request.map((item) => this.#response.subscribe(item)));
        const response = batch.filter((item) => item !== undefined);

        return response.length ? response : undefined;
    }

    #onReady(): void {
        this.#data = "";
    }

    #onDrain(): void {
        this.#socket.resume();
    }

    #onData(data: unknown): void {
        const payloads = (this.#data + data).split(SocketPeer.#nul);

        for (let index = 0; index < payloads.length - 1; index++) {
            this.#parsePayload(payloads[index]);
        }

        this.#data = payloads[payloads.length - 1];
    }

    #writeMessage(message: MaybeArray<JsonrpcMessage>): void {
        const payload = JSON.stringify(message);

        if (!this.#socket.write(payload + SocketPeer.#nul)) {
            this.#socket.pause();
        }
    }

    async #parsePayload(payload: string): Promise<void> {
        let message: JsonrpcMessage;

        try {
            message = JSON.parse(payload);
        } catch {
            return this.#writeMessage(JsonrpcError.parse("Malformed JSON"));
        }

        const response = await this.#receiveMessage(message);

        if (response !== undefined) {
            this.#writeMessage(response);
        }
    }

    async #receiveMessage(message: MaybeArray<JsonrpcMessage>): Promise<MaybeVoid<MaybeArray<JsonrpcResponse>>> {
        if (!Array.isArray(message)) {
            return this.#handleMessage(message);
        }

        if (!message.length) {
            return JsonrpcError.request("Empty batch");
        }

        const batch = await Promise.all(message.map((item) => this.#handleMessage(item)));
        const response = batch.filter((item) => item !== undefined);

        return response.length ? response : undefined;
    }

    async #handleMessage(message: JsonrpcMessage): Promise<MaybeVoid<JsonrpcResponse>> {
        if (!JsonrpcUtil.isMessage(message)) {
            return JsonrpcError.request("Uncompliant object");
        }

        if (JsonrpcUtil.isRequest(message)) {
            return this.#request.dispatch(message);
        }

        if (!JsonrpcUtil.isResponse(message)) {
            return JsonrpcError.request("Malformed JSON-RPC");
        }

        this.#response.publish(message);
    }
}
