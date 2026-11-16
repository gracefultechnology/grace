//@ backend dafny
// spec/app/conversation.md, "Detected private content is removed before the conversation continues"

export interface Leaving { text: string; passwords: string[] }

function isDigitAt(text: string, i: number): boolean {
  return 0 <= i && i < text.length && text.charCodeAt(i) >= 48 && text.charCodeAt(i) <= 57;
}

function isLetterAt(text: string, i: number): boolean {
  return 0 <= i && i < text.length
    && ((text.charCodeAt(i) >= 65 && text.charCodeAt(i) <= 90) || (text.charCodeAt(i) >= 97 && text.charCodeAt(i) <= 122));
}

function isSeparatorAt(text: string, i: number): boolean {
  if (i < 0 || i >= text.length) return false;
  const c = text.charCodeAt(i);
  return c === 32 || c === 45 || c === 46 || c === 9 || c === 10 || c === 13 || c === 160
    || c === 47 || c === 95 || c === 44 || c === 8211;
}

function isGapAt(text: string, i: number): boolean {
  if (i < 0 || i >= text.length) return false;
  const c = text.charCodeAt(i);
  return c === 32 || c === 45 || c === 160;
}

function digitValue(text: string, i: number): number {
  return isDigitAt(text, i) ? text.charCodeAt(i) - 48 : 0;
}

function doubled(digit: number): number {
  return digit * 2 > 9 ? digit * 2 - 9 : digit * 2;
}

function nextDigit(text: string, j: number, gap: number): number {
  //@ decreases gap
  if (isDigitAt(text, j)) return j;
  if (gap <= 0 || !isSeparatorAt(text, j)) return -1;
  return nextDigit(text, j + 1, gap - 1);
}

function previousDigit(text: string, j: number, gap: number): number {
  //@ decreases gap
  if (isDigitAt(text, j)) return j;
  if (gap <= 0 || !isSeparatorAt(text, j)) return -1;
  return previousDigit(text, j - 1, gap - 1);
}

function startsGroup(text: string, s: number): boolean {
  return isDigitAt(text, s) && !isDigitAt(text, s - 1);
}

function endsGroup(text: string, e: number): boolean {
  return isDigitAt(text, e) && !isDigitAt(text, e + 1);
}

function opensCard(text: string, s: number): boolean {
  const first = digitValue(text, s);
  const second = digitValue(text, nextDigit(text, s + 1, 3));
  return (first >= 3 && first <= 6) || (first === 2 && second >= 2 && second <= 7);
}

function cardEndsFrom(text: string, i: number, p: number, count: number, run: number, long: boolean, single: boolean, oddDoubled: number, evenDoubled: number, steps: number): boolean {
  //@ decreases steps
  if (count >= 13 && p >= i && endsGroup(text, p) && (long || single) && (count % 2 === 1 ? oddDoubled : evenDoubled) % 10 === 0) return true;
  if (steps <= 0) return false;
  const q = nextDigit(text, p + 1, 4);
  if (q < 0) return false;
  const joined = q === p + 1;
  const stillLong = long && (joined || run >= 4);
  const stillSingle = single && !joined;
  if (!stillLong && !stillSingle) return false;
  const digit = digitValue(text, q);
  const nextRun = joined ? run + 1 : 1;
  return count % 2 === 1
    ? cardEndsFrom(text, i, q, count + 1, nextRun, stillLong, stillSingle, oddDoubled + doubled(digit), evenDoubled + digit, steps - 1)
    : cardEndsFrom(text, i, q, count + 1, nextRun, stillLong, stillSingle, oddDoubled + digit, evenDoubled + doubled(digit), steps - 1);
}

function cardStartsBack(text: string, i: number, s: number, steps: number): boolean {
  //@ decreases steps
  if (startsGroup(text, s) && opensCard(text, s)
    && cardEndsFrom(text, i, s, 1, 1, true, true, digitValue(text, s), doubled(digitValue(text, s)), 18)) return true;
  if (steps <= 0) return false;
  const before = previousDigit(text, s - 1, 4);
  return before >= 0 && cardStartsBack(text, i, before, steps - 1);
}

function isCardDigit(text: string, i: number): boolean {
  return isDigitAt(text, i) && cardStartsBack(text, i, i, 18);
}

function wordBetween(text: string, from: number, to: number): string {
  return 0 <= from && from <= to && to <= text.length ? text.slice(from, to).toLowerCase() : "";
}

function wordStart(text: string, j: number, steps: number): number {
  //@ decreases steps
  if (steps > 0 && isLetterAt(text, j - 1)) return wordStart(text, j - 1, steps - 1);
  return j;
}

function wordEnd(text: string, j: number, steps: number): number {
  //@ decreases steps
  if (steps > 0 && isLetterAt(text, j)) return wordEnd(text, j + 1, steps - 1);
  return j;
}

function startsWordAt(text: string, at: number): boolean {
  return isLetterAt(text, at) && !isLetterAt(text, at - 1);
}

function cueOf(word: string): number {
  if (word === "cvv" || word === "cvc" || word === "cvvs" || word === "cvcs") return 3;
  return word === "code" || word === "codes" || word === "pin" || word === "pins" || word === "otp" || word === "otps"
    || word === "passcode" || word === "passcodes" || word === "password" || word === "passwords" ? 4 : 0;
}

function namesPlace(text: string, at: number): boolean {
  const before = wordBetween(text, wordStart(text, at - 2, 8), at - 1);
  return isLetterAt(text, at - 2) && !isLetterAt(text, at - 1) && !isDigitAt(text, at - 1) && (before === "zip" || before === "postal");
}

function cueBefore(text: string, j: number, steps: number): number {
  //@ decreases steps
  if (steps <= 0 || j < 0 || isDigitAt(text, j)) return 0;
  if (!isLetterAt(text, j)) return cueBefore(text, j - 1, steps - 1);
  const start = wordStart(text, j, 10);
  if (!startsWordAt(text, start)) return 0;
  const word = wordBetween(text, start, j + 1);
  if (word === "is" || word === "was" || word === "number") return cueBefore(text, start - 1, steps - 1);
  return namesPlace(text, start) ? 0 : cueOf(word);
}

function cueAfter(text: string, j: number, saidIs: boolean, steps: number): number {
  //@ decreases steps
  if (steps <= 0 || isDigitAt(text, j)) return 0;
  if (!isLetterAt(text, j)) return isGapAt(text, j) ? cueAfter(text, j + 1, saidIs, steps - 1) : 0;
  if (!startsWordAt(text, j)) return cueAfter(text, j + 1, saidIs, steps - 1);
  const word = wordBetween(text, j, wordEnd(text, j, 10));
  if (!saidIs) return word === "is" || word === "was" ? cueAfter(text, j + 1, true, steps - 1) : 0;
  return cueOf(word) > 0 ? cueOf(word) : cueAfter(text, j + 1, true, steps - 1);
}

function codeEndsFrom(text: string, i: number, p: number, count: number, cue: number, steps: number): boolean {
  //@ decreases steps
  if (p >= i && endsGroup(text, p)) {
    const named = cue > 0 ? cue : cueAfter(text, p + 1, false, 48);
    if (named > 0 && count >= named) return true;
  }
  if (steps <= 0) return false;
  const q = isDigitAt(text, p + 1) ? p + 1 : isGapAt(text, p + 1) && isDigitAt(text, p + 2) ? p + 2 : -1;
  return q >= 0 && codeEndsFrom(text, i, q, count + 1, cue, steps - 1);
}

function codeStartsBack(text: string, i: number, s: number, steps: number): boolean {
  //@ decreases steps
  if (startsGroup(text, s) && codeEndsFrom(text, i, s, 1, cueBefore(text, s - 1, 24), 9)) return true;
  if (steps <= 0) return false;
  const before = isDigitAt(text, s - 1) ? s - 1 : isGapAt(text, s - 1) && isDigitAt(text, s - 2) ? s - 2 : -1;
  return before >= 0 && codeStartsBack(text, i, before, steps - 1);
}

function isCodeDigit(text: string, i: number): boolean {
  return isDigitAt(text, i) && codeStartsBack(text, i, i, 9);
}

function occursAt(text: string, word: string, at: number): boolean {
  return word.length > 0 && 0 <= at && at + word.length <= text.length && text.charCodeAt(at) === word.charCodeAt(0)
    && text.slice(at, at + word.length) === word;
}

function covers(text: string, word: string, i: number, back: number): boolean {
  //@ decreases word.length - back
  if (back < 0 || back >= word.length) return false;
  return occursAt(text, word, i - back) || covers(text, word, i, back + 1);
}

export function isPrivateAt(text: string, passwords: string[], i: number): boolean {
  return isCardDigit(text, i) || isCodeDigit(text, i) || passwords.some((word) => word.length >= 4 && covers(text, word, i, 0));
}

function hidesPassword(text: string, passwords: string[], i: number): boolean {
  //@ ensures \result === exists(m, 0 <= m && m < passwords.length && passwords[m].length >= 4 && covers(text, passwords[m], i, 0))
  let j = 0;
  while (j < passwords.length) {
    //@ invariant 0 <= j && j <= passwords.length
    //@ invariant forall(m, 0 <= m && m < j ==> !(passwords[m].length >= 4 && covers(text, passwords[m], i, 0)))
    const word = passwords[j];
    let back = 0;
    while (word.length >= 4 && back < word.length) {
      //@ invariant 0 <= back && back <= word.length
      //@ invariant covers(text, word, i, 0) === covers(text, word, i, back)
      if (occursAt(text, word, i - back)) return true;
      back = back + 1;
    }
    j = j + 1;
  }
  return false;
}

function maskOnce(text: string, passwords: string[]): string {
  //@ ensures \result.length === text.length
  //@ ensures forall(k, 0 <= k && k < text.length ==> (isPrivateAt(text, passwords, k) ? \result.charCodeAt(k) === 42 : \result.charCodeAt(k) === text.charCodeAt(k)))
  let out = "";
  let i = 0;
  while (i < text.length) {
    //@ invariant 0 <= i && i <= text.length
    //@ invariant out.length === i
    //@ invariant forall(k, 0 <= k && k < i ==> (isPrivateAt(text, passwords, k) ? out.charCodeAt(k) === 42 : out.charCodeAt(k) === text.charCodeAt(k)))
    out = out + (isCardDigit(text, i) || isCodeDigit(text, i) || hidesPassword(text, passwords, i) ? "*" : text.slice(i, i + 1));
    i = i + 1;
  }
  return out;
}

function hidden(length: number): string {
  //@ ensures \result.length === length || length < 0
  //@ ensures forall(k, 0 <= k && k < \result.length ==> \result.charCodeAt(k) === 42)
  let out = "";
  while (out.length < length) {
    //@ invariant out.length <= length || length < 0
    //@ invariant forall(k, 0 <= k && k < out.length ==> out.charCodeAt(k) === 42)
    //@ decreases length - out.length
    out = out + "*";
  }
  return out;
}

export function withhold(leaving: Leaving): string {
  //@ ensures \result.length === leaving.text.length
  //@ ensures forall(k, 0 <= k && k < leaving.text.length ==> \result.charCodeAt(k) === 42 || \result.charCodeAt(k) === leaving.text.charCodeAt(k))
  //@ ensures forall(k, 0 <= k && k < leaving.text.length && isPrivateAt(leaving.text, leaving.passwords, k) ==> \result.charCodeAt(k) === 42)
  //@ ensures forall(k, 0 <= k && k < leaving.text.length ==> !isPrivateAt(leaving.text, leaving.passwords, k)) ==> \result === leaving.text
  //@ ensures forall(k, 0 <= k && k < \result.length ==> !isCardDigit(\result, k) && !isCodeDigit(\result, k))
  //@ ensures forall(j, forall(at, 0 <= j && j < leaving.passwords.length && leaving.passwords[j].length >= 4 && forall(k, 0 <= k && k < leaving.passwords[j].length ==> leaving.passwords[j].charCodeAt(k) !== 42) ==> !occursAt(\result, leaving.passwords[j], at)))
  const text = leaving.text;
  const passwords = leaving.passwords;
  let out = text;
  let next = maskOnce(text, passwords);
  let rounds = 0;
  while (next !== out && rounds < text.length) {
    //@ invariant out.length === text.length && next.length === text.length
    //@ invariant forall(k, 0 <= k && k < text.length ==> out.charCodeAt(k) === 42 || out.charCodeAt(k) === text.charCodeAt(k))
    //@ invariant forall(k, 0 <= k && k < text.length && isPrivateAt(text, passwords, k) ==> next.charCodeAt(k) === 42)
    //@ invariant forall(k, 0 <= k && k < text.length ==> (isPrivateAt(out, passwords, k) ? next.charCodeAt(k) === 42 : next.charCodeAt(k) === out.charCodeAt(k)))
    //@ invariant forall(k, 0 <= k && k < text.length ==> !isPrivateAt(text, passwords, k)) ==> out === text && next === out
    //@ decreases text.length - rounds
    out = next;
    next = maskOnce(out, passwords);
    rounds = rounds + 1;
  }
  if (next !== out) return hidden(text.length);
  //@ assert forall(k, 0 <= k && k < out.length && isPrivateAt(out, passwords, k) ==> out.charCodeAt(k) === 42)
  //@ assert forall(j, forall(at, 0 <= j && j < passwords.length && passwords[j].length >= 4 && occursAt(out, passwords[j], at) ==> covers(out, passwords[j], at, 0)))
  return out;
}
