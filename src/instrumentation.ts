// Runs once when the server starts. Only the Node.js runtime has the database.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startClock } = await import("./lib/scheduler");
    startClock();
  }
}
