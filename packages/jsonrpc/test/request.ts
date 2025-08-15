import { deepStrictEqual } from "node:assert";
import test, { after, before, suite } from "node:test";
import { setTimeout } from "node:timers/promises";
import type { JsonrpcFailure, JsonrpcSuccess } from "../src/index.ts";
import type { RouteMap } from "../src/peer-request.ts";
import SocketClient from "../src/socket-client.ts";
import SocketServer from "../src/socket-server.ts";

suite("Integration - Should verify the correct operation of JSON-RPC requests", () => {
    const router: RouteMap = {
        addition: (a: number, b: number) => a + b,
        timeout: (ms: number) => setTimeout(ms),
        throws: () => {
            throw new Error("Generic error");
        },
    };
    const server = new SocketServer(router, 1 * 1000);
    const client = new SocketClient(router, 1 * 1000);

    before(async () => {
        await server.listen("/run/request.sock");
        await client.connect("/run/request.sock");
    });

    after(async () => {
        await client.end();
        await server.close();
    });

    test("Requests to defined methods should return some result", async () => {
        const uuid = globalThis.crypto.randomUUID();
        const response = await client.peer.send({
            jsonrpc: "2.0",
            id: uuid,
            method: "addition",
            params: [2, 2],
        });

        deepStrictEqual<JsonrpcSuccess>(response, {
            jsonrpc: "2.0",
            id: uuid,
            result: 4,
        });
    });

    test("Requests with malformed JSON should return a -32700 error.", async () => {
        // @ts-expect-error: Test malformed JSON
        const response = await client.peer.send(undefined);

        deepStrictEqual<JsonrpcFailure>(response, {
            jsonrpc: "2.0",
            id: null,
            error: { code: -32700, message: "Parse error", data: "Malformed JSON" },
        });
    });

    test("Requests with an uncompliant object should return a -32600 error", async () => {
        // @ts-expect-error: Test uncompliant object
        const response = await client.peer.send(null);

        deepStrictEqual<JsonrpcFailure>(response, {
            jsonrpc: "2.0",
            id: null,
            error: { code: -32600, message: "Invalid request", data: "Uncompliant object" },
        });
    });

    test("Requests with an unsupported version should return a -32600 error", async () => {
        const uuid = globalThis.crypto.randomUUID();
        const response = await client.peer.send({
            // @ts-expect-error: Test unsupported version
            jsonrpc: "1.0",
            id: uuid,
            method: "addition",
            params: [2, 2],
        });

        deepStrictEqual<JsonrpcFailure>(response, {
            jsonrpc: "2.0",
            id: null,
            error: { code: -32600, message: "Invalid request", data: "Unsupported version" },
        });
    });

    test("Requests with an invalid identifier should return a -32600 error", async () => {
        const response = await client.peer.send({
            jsonrpc: "2.0",
            // @ts-expect-error: Test invalid identifier
            id: null,
            method: "addition",
            params: [2, 2],
        });

        deepStrictEqual<JsonrpcFailure>(response, {
            jsonrpc: "2.0",
            id: null,
            error: { code: -32600, message: "Invalid request", data: "Invalid identifier" },
        });
    });

    test("Requests to undefined methods should return a -32601 error", async () => {
        const uuid = globalThis.crypto.randomUUID();
        const response = await client.peer.send({
            jsonrpc: "2.0",
            id: uuid,
            method: "undefined",
        });

        deepStrictEqual<JsonrpcFailure>(response, {
            jsonrpc: "2.0",
            id: uuid,
            error: { code: -32601, message: "Method not found" },
        });
    });

    test("Requests with invalid params should return a -32602 error", async () => {
        const uuid = globalThis.crypto.randomUUID();
        const response = await client.peer.send({
            jsonrpc: "2.0",
            id: uuid,
            method: "addition",
            // @ts-expect-error: Test invalid parameters
            params: null,
        });

        deepStrictEqual<JsonrpcFailure>(response, {
            jsonrpc: "2.0",
            id: uuid,
            error: { code: -32602, message: "Invalid params" },
        });
    });

    test("Requests to methods that throw should return a -32603 error", async () => {
        const uuid = globalThis.crypto.randomUUID();
        const response = await client.peer.send({
            jsonrpc: "2.0",
            id: uuid,
            method: "throws",
        });

        deepStrictEqual<JsonrpcFailure>(response, {
            jsonrpc: "2.0",
            id: uuid,
            error: { code: -32603, message: "Internal error" },
        });
    });

    test("Requests that exceed timeout should return a -32060 error", async () => {
        const uuid = globalThis.crypto.randomUUID();
        const response = await client.peer.send({
            jsonrpc: "2.0",
            id: uuid,
            method: "timeout",
            params: [1.5 * 1000],
        });

        deepStrictEqual<JsonrpcFailure>(response, {
            jsonrpc: "2.0",
            id: uuid,
            error: { code: -32060, message: "Invalid response" },
        });
    });
});
