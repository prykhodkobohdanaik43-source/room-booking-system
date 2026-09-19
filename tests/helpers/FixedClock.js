export class FixedClock {
  constructor(now) {
    this.current = new Date(now);
  }

  now() {
    return new Date(this.current);
  }

  set(date) {
    this.current = new Date(date);
  }

  advanceSeconds(seconds) {
    this.current = new Date(this.current.getTime() + seconds * 1000);
  }

  advanceMinutes(minutes) {
    this.advanceSeconds(minutes * 60);
  }
}
