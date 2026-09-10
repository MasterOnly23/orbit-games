// Owns work that must settle before Electron may terminate the process.
function createLifecycle() {
  const pending = new Set();
  let closing = false;
  return {
    get closing() {
      return closing;
    },
    run(callback) {
      if (closing)
        return Promise.reject(
          new Error("Orbit está cerrando. Espera a que termine."),
        );
      const task = Promise.resolve().then(() => {
        if (closing)
          throw new Error("Orbit está cerrando. Espera a que termine.");
        return callback();
      });
      pending.add(task);
      task.then(
        () => pending.delete(task),
        () => pending.delete(task),
      );
      return task;
    },
    async drain(cancel, flush) {
      closing = true;
      cancel();
      while (pending.size) await Promise.allSettled([...pending]);
      await flush();
    },
    resume() {
      closing = false;
    },
  };
}
module.exports = { createLifecycle };
