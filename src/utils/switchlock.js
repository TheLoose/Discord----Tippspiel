/**
 * Tracks users who are currently switching teams.
 * While a user is in this set, messageReactionRemove will ignore their removals.
 * Key format: "userId:matchId"
 */
const switching = new Set();

function lockSwitch(userId, matchId) {
  switching.add(`${userId}:${matchId}`);
}

function unlockSwitch(userId, matchId) {
  switching.delete(`${userId}:${matchId}`);
}

function isSwitching(userId, matchId) {
  return switching.has(`${userId}:${matchId}`);
}

module.exports = { lockSwitch, unlockSwitch, isSwitching };