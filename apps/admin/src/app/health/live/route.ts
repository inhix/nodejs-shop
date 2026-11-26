/** Liveness for the Docker HEALTHCHECK and ECS. Deliberately has no dependencies. */
export function GET(): Response {
  return Response.json({ status: 'ok' });
}
