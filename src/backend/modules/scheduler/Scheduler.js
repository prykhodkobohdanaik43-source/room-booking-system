export class Scheduler {
  #jobs = [];
  #timers = [];

  constructor({ logger = console } = {}) {
    this.logger = logger;
  }

  register(job, intervalMs) {
    this.#jobs.push({ job, intervalMs });
    return this;
  }

  start() {
    this.stop();
    for (const { job, intervalMs } of this.#jobs) {
      const timer = setInterval(() => this.runOnce(job), intervalMs);
      timer.unref();
      this.#timers.push(timer);
    }
  }

  stop() {
    this.#timers.forEach(clearInterval);
    this.#timers = [];
  }

  async runOnce(job) {
    try {
      await job.run();
    } catch (err) {
      this.logger.error(`[scheduler] ${job.name}: ${err.message}`);
    }
  }
}
