import type { JsonrpcId, JsonrpcRequest, JsonrpcResponse } from "./index.ts";
import JsonrpcError from "./jsonrpc-error.ts";
import JsonrpcUtil, { type WithId } from "./jsonrpc-util.ts";
import type { MaybeVoid } from "./socket-peer.ts";

type ResultResolve = PromiseWithResolvers<JsonrpcResponse>["resolve"];

export default class PeerResponse {
    #broker: Map<JsonrpcId, ResultResolve>;
    #timeout: number;

    constructor(timeout: number = 0.5 * 60 * 1000) {
        this.#broker = new Map();
        this.#timeout = timeout;
    }

    async subscribe(request: JsonrpcRequest): Promise<MaybeVoid<JsonrpcResponse>> {
        if (!JsonrpcUtil.isMessage(request)) {
            return JsonrpcError.request("Uncompliant object");
        }

        if (!JsonrpcUtil.isRequest(request)) {
            return JsonrpcError.request("Malformed JSON-RPC");
        }

        if (request.jsonrpc !== "2.0") {
            return JsonrpcError.request("Unsupported version");
        }

        if (JsonrpcUtil.hasId(request)) {
            return this.#deferResponse(request);
        }

        if (request.id !== undefined) {
            return JsonrpcError.request("Invalid identifier");
        }
    }

    publish(response: JsonrpcResponse): void {
        if (response.id == null) {
            return undefined;
        }

        const resolve = this.#broker.get(response.id);

        if (resolve !== undefined) {
            resolve(response);
        }
    }

    async #deferResponse(request: WithId<JsonrpcRequest>): Promise<JsonrpcResponse> {
        const { promise, resolve } = Promise.withResolvers<JsonrpcResponse>();
        const timeout = this.#createTimeout(request, resolve);

        this.#broker.set(request.id, resolve);

        try {
            return await promise;
        } finally {
            this.#broker.delete(request.id);
            globalThis.clearTimeout(timeout);
        }
    }

    #createTimeout(request: WithId<JsonrpcRequest>, resolve: ResultResolve): NodeJS.Timeout {
        const error = new JsonrpcError(-32060, "Invalid response");

        return globalThis.setTimeout(resolve, this.#timeout, {
            jsonrpc: "2.0",
            id: request.id,
            error: error.toJSON(),
        });
    }
}
