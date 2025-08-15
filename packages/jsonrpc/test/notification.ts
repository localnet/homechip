import { deepStrictEqual, strictEqual } from "node:assert";
import test, { after, before, suite } from "node:test";
import { setTimeout } from "node:timers/promises";
import type { JsonrpcFailure } from "../src/index.ts";
import type { RouteMap } from "../src/peer-request.ts";
import SocketClient from "../src/socket-client.ts";
import SocketServer from "../src/socket-server.ts";

suite("Integration - Should verify the correct operation of JSON-RPC notifications", () => {
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
        await server.listen("/run/notification.sock");
        await client.connect("/run/notification.sock");
    });

    after(async () => {
        await client.end();
        await server.close();
    });

    test("Notifications to defined methods should not return any result", async () => {
        const response = await client.peer.send({
            jsonrpc: "2.0",
            method: "addition",
            params: [2, 2],
        });

        strictEqual(response, undefined);
    });

    test("Notifications with malformed JSON should return a -32700 error.", async () => {
        // @ts-expect-error: Test malformed JSON
        const response = await client.peer.send(undefined);

        deepStrictEqual<JsonrpcFailure>(response, {
            jsonrpc: "2.0",
            id: null,
            error: { code: -32700, message: "Parse error", data: "Malformed JSON" },
        });
    });

    test("Notifications with an uncompliant object should return a -32600 error", async () => {
        // @ts-expect-error: Test uncompliant object
        const response = await client.peer.send(null);

        deepStrictEqual<JsonrpcFailure>(response, {
            jsonrpc: "2.0",
            id: null,
            error: { code: -32600, message: "Invalid request", data: "Uncompliant object" },
        });
    });

    test("Notifications with an unsupported version should return a -32600 error", async () => {
        const response = await client.peer.send({
            // @ts-expect-error: Test unsupported version
            jsonrpc: "1.0",
            method: "addition",
            params: [2, 2],
        });

        deepStrictEqual(response, {
            jsonrpc: "2.0",
            id: null,
            error: { code: -32600, message: "Invalid request", data: "Unsupported version" },
        });
    });

    test("Notifications to undefined methods should not return any error", async () => {
        const response = await client.peer.send({
            jsonrpc: "2.0",
            method: "undefined",
        });

        strictEqual(response, undefined);
    });

    test("Notifications with invalid params should not return any error", async () => {
        const response = await client.peer.send({
            jsonrpc: "2.0",
            method: "addition",
            // @ts-expect-error: Test invalid parameters
            params: null,
        });

        strictEqual(response, undefined);
    });

    test("Notifications to methods that throw should not return any error", async () => {
        const response = await client.peer.send({
            jsonrpc: "2.0",
            method: "throws",
        });

        strictEqual(response, undefined);
    });

    test("Notifications that exceed timeout should not return any error", async () => {
        const response = await client.peer.send({
            jsonrpc: "2.0",
            method: "timeout",
            params: [1.5 * 1000],
        });

        strictEqual(response, undefined);
    });
});
