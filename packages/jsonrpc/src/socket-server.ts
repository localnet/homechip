import { Server, Socket } from "node:net";
import type { RouteMap } from "./peer-request.ts";
import SocketPeer from "./socket-peer.ts";

export default class SocketServer {
    #server: Server;
    #sockets: Set<Socket>;
    #peers: Set<SocketPeer>;

    constructor(router?: RouteMap, timeout?: number) {
        this.#server = new Server();
        this.#sockets = new Set();
        this.#peers = new Set();

        this.#server.on("connection", (socket) => this.#onConnection(socket, router, timeout));
    }

    get peers(): SocketPeer[] {
        return [...this.#peers];
    }

    async listen(path: string): Promise<void> {
        if (this.#server.listening) {
            return undefined;
        }

        const { promise, resolve, reject } = Promise.withResolvers<void>();

        this.#server.once("listening", resolve);
        this.#server.once("error", reject);
        this.#server.listen(path);

        try {
            await promise;
        } finally {
            this.#server.off("listening", resolve);
            this.#server.off("error", reject);
        }
    }

    async close(): Promise<void> {
        if (!this.#server.listening) {
            return undefined;
        }

        const { promise, resolve, reject } = Promise.withResolvers<void>();

        this.#server.once("close", resolve);
        this.#server.once("error", reject);
        this.#server.close();

        this.#sockets.forEach((socket) => socket.end());

        try {
            await promise;
        } finally {
            this.#server.off("close", resolve);
            this.#server.off("error", reject);
        }
    }

    #onConnection(socket: Socket, router?: RouteMap, timeout?: number): void {
        const peer = new SocketPeer(socket, router, timeout);

        socket.once("end", () => {
            this.#peers.delete(peer);
            this.#sockets.delete(socket);
        });

        socket.once("close", (forced) => {
            if (forced) {
                this.#peers.delete(peer);
                this.#sockets.delete(socket);
            }
        });

        this.#sockets.add(socket);
        this.#peers.add(peer);
    }
}
