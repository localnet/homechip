import { Socket } from "node:net";
import type { RouteMap } from "./peer-request.ts";
import SocketPeer from "./socket-peer.ts";

export default class SocketClient {
    #socket: Socket;
    #peer: SocketPeer;

    constructor(router?: RouteMap, timeout?: number) {
        this.#socket = new Socket();
        this.#peer = new SocketPeer(this.#socket, router, timeout);
    }

    get peer(): SocketPeer {
        return this.#peer;
    }

    async connect(path: string): Promise<void> {
        if (!this.#socket.pending) {
            return undefined;
        }

        const { promise, resolve, reject } = Promise.withResolvers<void>();

        this.#socket.once("connect", resolve);
        this.#socket.once("error", reject);
        this.#socket.connect(path);

        try {
            await promise;
        } finally {
            this.#socket.off("connect", resolve);
            this.#socket.off("error", reject);
        }
    }

    async end(): Promise<void> {
        if (this.#socket.pending) {
            return undefined;
        }

        const { promise, resolve, reject } = Promise.withResolvers<void>();

        this.#socket.once("end", resolve);
        this.#socket.once("error", reject);
        this.#socket.end();

        try {
            await promise;
        } finally {
            this.#socket.off("end", resolve);
            this.#socket.off("error", reject);
        }
    }
}
