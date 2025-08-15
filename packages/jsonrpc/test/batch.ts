import { deepStrictEqual } from "node:assert";
import test, { after, before, suite } from "node:test";
import { setTimeout } from "node:timers/promises";
import type { JsonrpcFailure, JsonrpcSuccess } from "../src/index.ts";
import type { RouteMap } from "../src/peer-request.ts";
import SocketClient from "../src/socket-client.ts";
import SocketServer from "../src/socket-server.ts";

suite("Integration - Should verify the correct operation of JSON-RPC batches", () => {
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
        await server.listen("/run/batch.sock");
        await client.connect("/run/batch.sock");
    });

    after(async () => {
        await client.end();
        await server.close();
    });

    test("Batches to defined methods should only return some result to requests", async () => {
        const uuid = globalThis.crypto.randomUUID();
        const response = await client.peer.send([
            {
                jsonrpc: "2.0",
                id: uuid,
                method: "addition",
                params: [2, 2],
            },
            {
                jsonrpc: "2.0",
                method: "addition",
                params: [2, 2],
            },
        ]);

        deepStrictEqual<[JsonrpcSuccess]>(response, [
            {
                jsonrpc: "2.0",
                id: uuid,
                result: 4,
            },
        ]);
    });

    test("Batches without data (empty batch) should return a -32600 error", async () => {
        const response = await client.peer.send([]);

        deepStrictEqual<JsonrpcFailure>(response, {
            jsonrpc: "2.0",
            id: null,
            error: { code: -32600, message: "Invalid request", data: "Empty batch" },
        });
    });

    test("Batches with an uncompliant object should return a -32600 error", async () => {
        // @ts-expect-error: Test uncompliant object
        const response = await client.peer.send([null, null]);

        deepStrictEqual<[JsonrpcFailure, JsonrpcFailure]>(response, [
            {
                jsonrpc: "2.0",
                id: null,
                error: { code: -32600, message: "Invalid request", data: "Uncompliant object" },
            },
            {
                jsonrpc: "2.0",
                id: null,
                error: { code: -32600, message: "Invalid request", data: "Uncompliant object" },
            },
        ]);
    });

    test("Batches with an unsupported version should return a -32600 error", async () => {
        const uuid = globalThis.crypto.randomUUID();
        const response = await client.peer.send([
            {
                // @ts-expect-error: Test unsupported version
                jsonrpc: "1.0",
                id: uuid,
                method: "addition",
                params: [2, 2],
            },
            {
                // @ts-expect-error: Test unsupported version
                jsonrpc: "1.0",
                method: "addition",
                params: [2, 2],
            },
        ]);

        deepStrictEqual<[JsonrpcFailure, JsonrpcFailure]>(response, [
            {
                jsonrpc: "2.0",
                id: null,
                error: { code: -32600, message: "Invalid request", data: "Unsupported version" },
            },
            {
                jsonrpc: "2.0",
                id: null,
                error: { code: -32600, message: "Invalid request", data: "Unsupported version" },
            },
        ]);
    });

    test("Batches with an invalid identifier should return a -32600 error", async () => {
        const response = await client.peer.send([
            {
                jsonrpc: "2.0",
                // @ts-expect-error: Test invalid identifier
                id: null,
                method: "addition",
                params: [2, 2],
            },
            {
                jsonrpc: "2.0",
                method: "addition",
                params: [2, 2],
            },
        ]);

        deepStrictEqual<[JsonrpcFailure]>(response, [
            {
                jsonrpc: "2.0",
                id: null,
                error: { code: -32600, message: "Invalid request", data: "Invalid identifier" },
            },
        ]);
    });

    test("Batches to undefined methods should only return a -32601 error to requests", async () => {
        const uuid = globalThis.crypto.randomUUID();
        const response = await client.peer.send([
            {
                jsonrpc: "2.0",
                id: uuid,
                method: "undefined",
            },
            {
                jsonrpc: "2.0",
                method: "undefined",
            },
        ]);

        deepStrictEqual<[JsonrpcFailure]>(response, [
            {
                jsonrpc: "2.0",
                id: uuid,
                error: { code: -32601, message: "Method not found" },
            },
        ]);
    });

    test("Batches with invalid params should only return a -32602 error to requests", async () => {
        const uuid = globalThis.crypto.randomUUID();
        const response = await client.peer.send([
            {
                jsonrpc: "2.0",
                id: uuid,
                method: "addition",
                // @ts-expect-error: Test invalid parameters
                params: null,
            },
            {
                jsonrpc: "2.0",
                method: "addition",
                // @ts-expect-error: Test invalid parameters
                params: null,
            },
        ]);

        deepStrictEqual<[JsonrpcFailure]>(response, [
            {
                jsonrpc: "2.0",
                id: uuid,
                error: { code: -32602, message: "Invalid params" },
            },
        ]);
    });

    test("Batches to methods that throw should only return a -32603 error to requests", async () => {
        const uuid = globalThis.crypto.randomUUID();
        const response = await client.peer.send([
            {
                jsonrpc: "2.0",
                id: uuid,
                method: "throws",
            },
            {
                jsonrpc: "2.0",
                method: "throws",
            },
        ]);

        deepStrictEqual<[JsonrpcFailure]>(response, [
            {
                jsonrpc: "2.0",
                id: uuid,
                error: { code: -32603, message: "Internal error" },
            },
        ]);
    });

    test("Batches that exceed timeout should only return a -32060 error to requests", async () => {
        const uuid = globalThis.crypto.randomUUID();
        const response = await client.peer.send([
            {
                jsonrpc: "2.0",
                id: uuid,
                method: "timeout",
                params: [1.5 * 1000],
            },
            {
                jsonrpc: "2.0",
                method: "timeout",
                params: [1.5 * 1000],
            },
        ]);

        deepStrictEqual<[JsonrpcFailure]>(response, [
            {
                jsonrpc: "2.0",
                id: uuid,
                error: { code: -32060, message: "Invalid response" },
            },
        ]);
    });

    test("Batches with notifications that exceed timeout should not block requests", async () => {
        const uuid = globalThis.crypto.randomUUID();
        const response = await client.peer.send([
            {
                jsonrpc: "2.0",
                id: uuid,
                method: "addition",
                params: [2, 2],
            },
            {
                jsonrpc: "2.0",
                method: "timeout",
                params: [1.5 * 1000],
            },
        ]);

        deepStrictEqual<[JsonrpcSuccess]>(response, [
            {
                jsonrpc: "2.0",
                id: uuid,
                result: 4,
            },
        ]);
    });
});
