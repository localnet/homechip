import type { JsonrpcFailure } from "./index.ts";

export default class JsonrpcError extends Error {
    code: number;

    constructor(code: number, message: string, options?: ErrorOptions) {
        super(message, options);

        this.code = code;
    }

    static parse(cause?: unknown): JsonrpcFailure {
        const error = new JsonrpcError(-32700, "Parse error", { cause });

        return {
            jsonrpc: "2.0",
            id: null,
            error: error.toJSON(),
        };
    }

    static request(cause?: unknown): JsonrpcFailure {
        const error = new JsonrpcError(-32600, "Invalid request", { cause });

        return {
            jsonrpc: "2.0",
            id: null,
            error: error.toJSON(),
        };
    }

    toJSON(): JsonrpcFailure["error"] {
        return {
            code: this.code,
            message: this.message,
            ...(this.cause ? { data: this.cause } : undefined),
        };
    }
}
