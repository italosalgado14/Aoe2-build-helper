// Game clock. Derives elapsed game time from wall-clock timestamps rather than
// accumulating tick deltas, so background-tab throttling can slow the *display*
// refresh without ever corrupting the time itself.
export class GameClock {
  constructor(speed) {
    this.speed = speed;
    this.bankedGameSeconds = 0; // game time from all previous running spans
    this.runSince = null;       // wall ms when the current running span began
  }

  get running() {
    return this.runSince !== null;
  }

  // Game seconds elapsed. Wall time is multiplied by speed, matching how the
  // in-game clock advances relative to real time.
  get gameSeconds() {
    if (!this.running) return this.bankedGameSeconds;
    return this.bankedGameSeconds + ((Date.now() - this.runSince) / 1000) * this.speed;
  }

  // Close the current span into the bank. Used before any speed/state change.
  #bank() {
    if (this.running) {
      this.bankedGameSeconds += ((Date.now() - this.runSince) / 1000) * this.speed;
      this.runSince = Date.now();
    }
  }

  start() {
    if (!this.running) this.runSince = Date.now();
  }

  pause() {
    this.#bank();
    this.runSince = null;
  }

  toggle() {
    this.running ? this.pause() : this.start();
  }

  reset() {
    this.bankedGameSeconds = 0;
    this.runSince = null;
  }

  // Changing speed mid-run must not move the clock: bank first, then switch.
  setSpeed(speed) {
    this.#bank();
    this.speed = speed;
  }

  // Jump the clock to a specific game time, keeping the running state.
  seek(gameSeconds) {
    this.bankedGameSeconds = Math.max(0, gameSeconds);
    if (this.running) this.runSince = Date.now();
  }
}
