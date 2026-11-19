//@ backend dafny
// spec/app/workspace.md, "A read plan offered in chat waits for the person to start it"; spec/app/workspace.md, "Only a current observation of the next outcome advances the plan"

function charAt(text: string, i: number): number {
  return 0 <= i && i < text.length ? text.charCodeAt(i) : -1;
}

function isLetterAt(text: string, i: number): boolean {
  const c = charAt(text, i);
  return (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 192 && c <= 591 && c !== 215 && c !== 247);
}

export function foldedAt(text: string, i: number): number {
  const c = charAt(text, i);
  return (c === 8216 || c === 8217) && isLetterAt(text, i - 1) && isLetterAt(text, i + 1) ? 39 : c;
}

export function foldApostrophes(text: string): string {
  //@ ensures \result.length === text.length
  //@ ensures forall(k, 0 <= k && k < text.length ==> \result.charCodeAt(k) === foldedAt(text, k))
  let out = "";
  let i = 0;
  while (i < text.length) {
    //@ invariant 0 <= i && i <= text.length
    //@ invariant out.length === i
    //@ invariant forall(k, 0 <= k && k < i ==> out.charCodeAt(k) === foldedAt(text, k))
    out = out + (foldedAt(text, i) === 39 ? "'" : text.slice(i, i + 1));
    i = i + 1;
  }
  return out;
}

function matchesFrom(words: string, name: string, at: number, k: number): boolean {
  //@ decreases name.length - k
  return k >= name.length || (foldedAt(words, at + k) === foldedAt(name, k) && matchesFrom(words, name, at, k + 1));
}

export function quotesAt(words: string, name: string, at: number): boolean {
  return name.length > 0 && 0 <= at && at + name.length <= words.length && matchesFrom(words, name, at, 0);
}

export function quotedAt(words: string, name: string): number {
  //@ ensures \result === -1 || quotesAt(words, name, \result)
  //@ ensures \result === -1 ==> forall(at, !quotesAt(words, name, at))
  let at = 0;
  while (at + name.length <= words.length) {
    //@ invariant 0 <= at && at <= words.length + 1
    //@ invariant forall(m, 0 <= m && m < at ==> !quotesAt(words, name, m))
    //@ decreases words.length + 1 - at
    if (quotesAt(words, name, at)) return at;
    at = at + 1;
  }
  return -1;
}
