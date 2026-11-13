// Keep native writes in order. Coalesce queued keystrokes while a write is pending.
// Every caller resolves only after its state (or a newer state) is persisted.
export function createSaveQueue(write) {
  let running = false;
  let pending = null;
  async function drain() {
    running = true;
    while (pending) {
      const batch = pending;
      pending = null;
      try {
        await write(batch.value);
        batch.waiters.forEach(({ resolve }) => resolve());
      } catch (error) {
        batch.waiters.forEach(({ reject }) => reject(error));
      }
    }
    running = false;
  }
  return {
    save(value) {
      return new Promise((resolve, reject) => {
        if (!pending) pending = { value, waiters: [] };
        pending.value = value;
        pending.waiters.push({ resolve, reject });
        if (!running) void drain();
      });
    },
  };
}
