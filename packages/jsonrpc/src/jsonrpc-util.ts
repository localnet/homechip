import type { JsonrpcId, JsonrpcMessage, JsonrpcRequest, JsonrpcResponse } from "./index.ts";

export type WithId<TJsonrpc extends JsonrpcMessage> = TJsonrpc & { id: JsonrpcId };

export default class JsonrpcUtil {
    static isMessage<TJsonrpc extends JsonrpcMessage>(message: TJsonrpc): message is TJsonrpc {
        return typeof message === "object" && message && !Array.isArray(message);
    }

    static isRequest(message: JsonrpcMessage): message is JsonrpcRequest {
        let required = 0;

        for (const key of Object.keys(message)) {
            switch (key) {
                case "jsonrpc":
                case "method":
                    required++;
                    break;
                case "id":
                case "params":
                    break;
                default:
                    return false;
            }
        }

        return required === 2;
    }

    static isResponse(message: JsonrpcMessage): message is JsonrpcResponse {
        let required = 0;

        for (const key of Object.keys(message)) {
            switch (key) {
                case "jsonrpc":
                case "id":
                case "result":
                case "error":
                    required++;
                    break;
                default:
                    return false;
            }
        }

        return required === 3;
    }

    static hasId<TJsonrpc extends JsonrpcMessage>(message: TJsonrpc): message is WithId<TJsonrpc> {
        return typeof message.id === "string" || typeof message.id === "number";
    }
}
