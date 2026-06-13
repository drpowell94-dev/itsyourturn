// The "table reader" — a quiet narrator that turns raw scores into one
// plain-language observation. Deterministic, instant, and always honest
// about the state of the table.

type Standing = { initials: string; total: number };

const name = (p: Standing) => p.initials || "???";

export function flip7Reader(standings: Standing[], target: number): string {
  if (standings.length === 0) {
    return "Add the people at your table and I'll keep the running order.";
  }
  const sorted = [...standings].sort((a, b) => b.total - a.total);
  const [lead, second] = sorted;
  if (lead.total >= target) {
    return `${name(lead)} takes the game at ${lead.total}. Well played, everyone.`;
  }
  if (lead.total === 0) {
    return "No scores on the sheet yet — the first hand sets the tone.";
  }
  const toGo = target - lead.total;
  if (second && second.total === lead.total) {
    return `${name(lead)} and ${name(second)} are tied at ${lead.total}, each ${toGo} away from ${target}.`;
  }
  if (second) {
    return `${name(lead)} leads ${name(second)} by ${lead.total - second.total} and needs ${toGo} more to reach ${target}.`;
  }
  return `${name(lead)} sits at ${lead.total} — ${toGo} to go.`;
}

// Generic round-game narration. High games (UNO, Farkle, custom-high) read
// like Flip 7; low games (Hearts, custom-low) end when anyone hits the
// ceiling and the lowest total wins.
export function roundsReader(
  standings: Standing[],
  target: number,
  lowWins: boolean,
): string {
  if (!lowWins) return flip7Reader(standings, target);
  if (standings.length === 0) {
    return "Add the people at your table and I'll keep the running order.";
  }
  const asc = [...standings].sort((a, b) => a.total - b.total);
  const [lead, second] = asc;
  const high = asc[asc.length - 1];
  if (high.total >= target) {
    return `${name(high)} hits ${high.total} — that's the game! ${name(lead)} wins low with ${lead.total}.`;
  }
  if (standings.every((p) => p.total === 0)) {
    return `Lowest score wins — the game ends when anyone reaches ${target}.`;
  }
  if (second && second.total === lead.total) {
    return `${name(lead)} and ${name(second)} are tied low at ${lead.total}. ${name(high)} is closest to the ${target}-point ceiling at ${high.total}.`;
  }
  return `${name(lead)} sits safest at ${lead.total}; ${name(high)} is ${target - high.total} from the ${target}-point ceiling.`;
}

export function phase10Reader(
  players: { initials: string; total: number; phase: number }[],
): string {
  if (players.length === 0) {
    return "Add the people at your table and I'll track everyone's phase.";
  }
  const finished = players.filter((p) => p.phase > 10);
  if (finished.length > 0) {
    const w = [...finished].sort((a, b) => a.total - b.total)[0];
    return `${w.initials || "???"} clears all ten phases with ${w.total} points. That's the game.`;
  }
  const sorted = [...players].sort(
    (a, b) => (b.phase - a.phase) || (a.total - b.total),
  );
  const [lead, second] = sorted;
  if (lead.phase === 1 && players.every((p) => p.total === 0)) {
    return "Everyone starts on phase 1. Lowest score wins if it comes to a tie.";
  }
  if (second && second.phase === lead.phase) {
    return `${name(lead)} and ${name(second)} are both on phase ${lead.phase} — ${name(lead)} holds the lower score.`;
  }
  return `${name(lead)} is furthest along on phase ${lead.phase} with ${lead.total} points.`;
}

export function spadesReader(
  teams: Standing[],
  target: number,
  trickSum: number | null,
  tricksPerHand: number,
): string {
  if (teams.length !== 2) return "Setting up the two teams…";
  if (trickSum !== null && trickSum > tricksPerHand) {
    return `Those tricks add up to ${trickSum} — there are only ${tricksPerHand} in a hand. One count is off.`;
  }
  const [a, b] = teams;
  const lead = a.total >= b.total ? a : b;
  const trail = lead === a ? b : a;
  if (lead.total >= target) {
    return `${name(lead)} reaches ${lead.total} and takes the match.`;
  }
  if (a.total === 0 && b.total === 0) {
    return `First to ${target}. Bid carefully — a missed bid costs the whole thing.`;
  }
  if (a.total === b.total) {
    return `All square at ${a.total}. First to ${target} takes it.`;
  }
  return `${name(lead)} leads ${name(trail)} by ${lead.total - trail.total}, ${target - lead.total} short of ${target}.`;
}
