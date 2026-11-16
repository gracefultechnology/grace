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
  return c === 32 || c === 45 || c === 46 || c === 9 || c === 10 || c === 13 || c === 160;
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

function cardEndsFrom(text: string, i: number, p: number, count: number, oddDoubled: number, evenDoubled: number, steps: number): boolean {
  //@ decreases steps
  if (count >= 13 && p >= i && endsGroup(text, p) && (count % 2 === 1 ? oddDoubled : evenDoubled) % 10 === 0) return true;
  if (steps <= 0) return false;
  const q = nextDigit(text, p + 1, 3);
  if (q < 0) return false;
  const digit = digitValue(text, q);
  return count % 2 === 1
    ? cardEndsFrom(text, i, q, count + 1, oddDoubled + doubled(digit), evenDoubled + digit, steps - 1)
    : cardEndsFrom(text, i, q, count + 1, oddDoubled + digit, evenDoubled + doubled(digit), steps - 1);
}

function cardStartsBack(text: string, i: number, s: number, steps: number): boolean {
  //@ decreases steps
  if (startsGroup(text, s) && cardEndsFrom(text, i, s, 1, digitValue(text, s), doubled(digitValue(text, s)), 18)) return true;
  if (steps <= 0) return false;
  const before = previousDigit(text, s - 1, 3);
  return before >= 0 && cardStartsBack(text, i, before, steps - 1);
}

function isCardDigit(text: string, i: number): boolean {
  return isDigitAt(text, i) && cardStartsBack(text, i, i, 18);
}

function groupsEndFrom(text: string, i: number, p: number, count: number, least: number, steps: number): boolean {
  //@ decreases steps
  if (count >= least && p >= i && endsGroup(text, p)) return true;
  if (steps <= 0) return false;
  const q = nextDigit(text, p + 1, 3);
  return q >= 0 && groupsEndFrom(text, i, q, count + 1, least, steps - 1);
}

function groupsStartBack(text: string, i: number, s: number, least: number, most: number, steps: number): boolean {
  //@ decreases steps
  if (startsGroup(text, s) && groupsEndFrom(text, i, s, 1, least, most - 1)) return true;
  if (steps <= 0) return false;
  const before = previousDigit(text, s - 1, 3);
  return before >= 0 && groupsStartBack(text, i, before, least, most, steps - 1);
}

function lowerAt(text: string, at: number): number {
  if (at < 0 || at >= text.length) return -1;
  const c = text.charCodeAt(at);
  return c >= 65 && c <= 90 ? c + 32 : c;
}

function isWordAt(text: string, at: number, word: string): boolean {
  return word.length > 0 && 0 <= at && at + word.length <= text.length && lowerAt(text, at) === word.charCodeAt(0) && !isLetterAt(text, at + word.length)
    && text.slice(at, at + word.length).toLowerCase() === word;
}

function startsWordAt(text: string, at: number): boolean {
  return isLetterAt(text, at) && !isLetterAt(text, at - 1);
}

function namesCardCodeAt(text: string, at: number): boolean {
  return startsWordAt(text, at) && (isWordAt(text, at, "cvv") || isWordAt(text, at, "cvc"));
}

function namesCodeAt(text: string, at: number): boolean {
  return namesCardCodeAt(text, at) || (startsWordAt(text, at) && (isWordAt(text, at, "code") || isWordAt(text, at, "pin")
    || isWordAt(text, at, "otp") || isWordAt(text, at, "passcode") || isWordAt(text, at, "password")));
}

function namedFrom(text: string, at: number, end: number, cardCode: boolean): boolean {
  //@ decreases end - at
  if (at >= end) return false;
  return (cardCode ? namesCardCodeAt(text, at) : namesCodeAt(text, at)) || namedFrom(text, at + 1, end, cardCode);
}

function isCodeDigit(text: string, i: number): boolean {
  return isDigitAt(text, i)
    && ((groupsStartBack(text, i, i, 4, 8, 7) && namedFrom(text, i - 48, i + 48, false))
      || (groupsStartBack(text, i, i, 3, 3, 2) && namedFrom(text, i - 48, i + 48, true)));
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
