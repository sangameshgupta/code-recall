import type { Response } from 'express';

interface SSEClient {
  id: string;
  res: Response;
}

export class SSEBroadcaster {
  private clients: SSEClient[] = [];

  /**
   * Add a new SSE client connection
   */
  addClient(res: Response): string {
    const id = `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Nginx compat
    });

    // Send initial keepalive
    res.write(': keepalive\n\n');

    const client: SSEClient = { id, res };
    this.clients.push(client);

    // Remove client on disconnect
    res.on('close', () => {
      this.clients = this.clients.filter(c => c.id !== id);
    });

    return id;
  }

  /**
   * Broadcast an event to all connected clients
   */
  broadcast(event: string, data: unknown): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

    for (const client of this.clients) {
      try {
        client.res.write(payload);
      } catch {
        // Client disconnected, will be cleaned up
      }
    }
  }

  /**
   * Number of connected clients
   */
  get clientCount(): number {
    return this.clients.length;
  }

  /**
   * Disconnect all clients
   */
  disconnectAll(): void {
    for (const client of this.clients) {
      try {
        client.res.end();
      } catch {
        // Ignore
      }
    }
    this.clients = [];
  }
}
