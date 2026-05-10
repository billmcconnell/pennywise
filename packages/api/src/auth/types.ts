declare module 'fastify' {
  interface FastifyRequest {
    household: { id: string; name: string } | null;
    user: { id: string; email: string } | null;
  }
}

export {};
