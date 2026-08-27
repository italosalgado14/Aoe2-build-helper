// Which step the play view is showing, and whether the clock or the player is
// driving that choice.
//
// The clock runs on the ideal zero-idle timeline; real games run behind it. So
// a manual jump BEHIND the clock must stick — that is the whole point of the
// button — while a jump AHEAD of the clock is the player being faster than the
// build, and control hands back automatically once the clock catches up.
export class FollowState {
  constructor() {
    this.auto = true;
    this.index = 0;
    this.pinnedAhead = false; // was the manual jump ahead of the clock?
  }

  // Called every frame with the index the clock alone would pick.
  resolve(autoIndex) {
    if (this.auto) {
      this.index = autoIndex;
    } else if (this.pinnedAhead && autoIndex >= this.index) {
      this.auto = true;
      this.pinnedAhead = false;
      this.index = autoIndex;
    }
    return this.index;
  }

  goTo(target, autoIndex) {
    if (target === autoIndex) return this.follow(autoIndex);
    this.auto = false;
    this.index = target;
    this.pinnedAhead = target > autoIndex;
  }

  follow(autoIndex) {
    this.auto = true;
    this.pinnedAhead = false;
    this.index = autoIndex;
  }
}
