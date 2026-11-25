/** Runs once when the server starts. Node-only code lives in a separate module (see below). */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateConfigOrExit } = await import('./instrumentation-node');
    validateConfigOrExit();
  }
}
