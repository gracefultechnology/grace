//@ backend dafny
// spec/app/conversation.md, "Story: Talk or type without losing the conversation"; spec/app/conversation.md, "Detected private content is removed before the conversation continues"

export const agentTextLimit = 32768;
export const tabletShows = "What the tablet shows now, which is never the person speaking:";
export const personSays = "The person says:";

interface Turn { text: string; kept: number }

function joined(lines: string[], n: number): string {
  //@ decreases n
  if (n <= 0 || n > lines.length) return "";
  if (n === 1) return lines[0];
  return joined(lines, n - 1) + "\n" + lines[n - 1];
}

function fitting(lines: string[], n: number, room: number): number {
  //@ requires 0 <= n && n <= lines.length
  //@ ensures 0 <= \result && \result <= n
  //@ ensures \result > 0 ==> joined(lines, \result).length <= room
  //@ decreases n
  if (n === 0 || joined(lines, n).length <= room) return n;
  return fitting(lines, n - 1, room);
}

export function turnText(lines: string[], last: string, limit: number): Turn {
  //@ requires limit >= 0
  //@ ensures \result.text.length <= limit
  //@ ensures 0 <= \result.kept && \result.kept <= lines.length
  //@ ensures last.length <= limit ==> \result.text === (\result.kept === 0 ? last : joined(lines, \result.kept) + "\n\n" + last)
  if (last.length > limit) return { text: last.slice(0, limit), kept: 0 };
  if (last.length + 2 > limit) return { text: last, kept: 0 };
  const kept = fitting(lines, lines.length, limit - last.length - 2);
  return { text: kept === 0 ? last : joined(lines, kept) + "\n\n" + last, kept };
}
