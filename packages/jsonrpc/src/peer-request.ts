import type { JsonrpcRequest, JsonrpcResponse } from "./index.ts";
import JsonrpcError from "./jsonrpc-error.ts";
import JsonrpcUtil, { type WithId } from "./jsonrpc-util.ts";
import type { MaybeVoid } from "./socket-peer.ts";

export type RouteMethod = (...params: any[]) => unknown;
export type RouteMap = Record<string, RouteMethod>;

export default class PeerRequest {
    #router: RouteMap;

    constructor(router: RouteMap = {}) {
        this.#router = router;
    }

    async dispatch(request: JsonrpcRequest): Promise<MaybeVoid<JsonrpcResponse>> {
        if (request.jsonrpc !== "2.0") {
            return JsonrpcError.request("Unsupported version");
        }

        if (JsonrpcUtil.hasId(request)) {
            return this.#replyRequest(request);
        }

        if (request.id !== undefined) {
            return JsonrpcError.request("Invalid identifier");
        }

        this.#silenceRequest(request);
    }

    async #replyRequest(request: WithId<JsonrpcRequest>): Promise<JsonrpcResponse> {
        try {
            const method = this.#findMethod(request);
            const params = this.#normalizeParams(request);

            return {
                jsonrpc: "2.0",
                id: request.id,
                result: await method(...params),
            };
        } catch (error) {
            return {
                jsonrpc: "2.0",
                id: request.id,
                error: this.#maskError(error),
            };
        }
    }

    async #silenceRequest(request: JsonrpcRequest): Promise<void> {
        try {
            const method = this.#findMethod(request);
            const params = this.#normalizeParams(request);

            await method(...params);
        } catch {
            return undefined;
        }
    }

    #findMethod({ method }: JsonrpcRequest): RouteMethod {
        if (!Object.hasOwn(this.#router, method)) {
            throw new JsonrpcError(-32601, "Method not found");
        }

        return this.#router[method];
    }

    #normalizeParams({ params }: JsonrpcRequest): unknown[] {
        if (params === undefined) {
            return [];
        }

        if (!Array.isArray(params)) {
            throw new JsonrpcError(-32602, "Invalid params");
        }

        return params;
    }

    #maskError(error: unknown): JsonrpcError {
        if (error instanceof JsonrpcError) {
            return error;
        }

        return new JsonrpcError(-32603, "Internal error");
    }
}
