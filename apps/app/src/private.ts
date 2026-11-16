//@ backend dafny
// spec/app/conversation.md, "Detected private content is removed before the conversation continues"

export interface Leaving { text: string; passwords: string[] }

function charAt(text: string, i: number): number {
  return 0 <= i && i < text.length ? text.charCodeAt(i) : -1;
}

function isDigitAt(text: string, i: number): boolean {
  return charAt(text, i) >= 48 && charAt(text, i) <= 57;
}

function isLetterAt(text: string, i: number): boolean {
  const c = charAt(text, i);
  return (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
}

function isWordAt(text: string, i: number): boolean {
  return isLetterAt(text, i) || isDigitAt(text, i) || charAt(text, i) === 42;
}

function isSpaceAt(text: string, i: number): boolean {
  const c = charAt(text, i);
  return c === 32 || c === 9 || c === 10 || c === 13 || c === 160;
}

function isCardGapAt(text: string, i: number): boolean {
  const c = charAt(text, i);
  return isSpaceAt(text, i) || c === 44 || c === 45 || c === 46 || c === 47 || c === 95 || c === 124
    || c === 8199 || c === 8201 || c === 8239 || c === 8208 || c === 8209 || c === 8211 || c === 8722;
}

function isCodeJoinAt(text: string, i: number): boolean {
  const c = charAt(text, i);
  return c === 32 || c === 45 || c === 160 || c === 8209;
}

function isNumberMarkAt(text: string, i: number): boolean {
  const c = charAt(text, i);
  return c === 44 || c === 45 || c === 46 || c === 47 || c === 58 || c === 8211;
}

function markedBefore(text: string, s: number): boolean {
  return isNumberMarkAt(text, s - 1) && isDigitAt(text, s - 2);
}

function markedAfter(text: string, e: number): boolean {
  return isNumberMarkAt(text, e) && isDigitAt(text, e + 1);
}

function endsSentenceAt(text: string, i: number): boolean {
  const c = charAt(text, i);
  return (c === 46 || c === 63 || c === 33) && (i + 1 >= text.length || isSpaceAt(text, i + 1));
}

function digitValue(text: string, i: number): number {
  return isDigitAt(text, i) ? text.charCodeAt(i) - 48 : 0;
}

function doubled(digit: number): number {
  return digit * 2 > 9 ? digit * 2 - 9 : digit * 2;
}

function runEnd(text: string, j: number, steps: number): number {
  //@ decreases steps
  return steps > 0 && isDigitAt(text, j) ? runEnd(text, j + 1, steps - 1) : j;
}

function runStart(text: string, j: number, steps: number): number {
  //@ decreases steps
  return steps > 0 && isDigitAt(text, j - 1) ? runStart(text, j - 1, steps - 1) : j;
}

function gapEnd(text: string, j: number, steps: number): number {
  //@ decreases steps
  return steps > 0 && isCardGapAt(text, j) ? gapEnd(text, j + 1, steps - 1) : j;
}

function gapStart(text: string, j: number, steps: number): number {
  //@ decreases steps
  return steps > 0 && isCardGapAt(text, j - 1) ? gapStart(text, j - 1, steps - 1) : j;
}

function sameText(text: string, a: number, b: number, c: number, d: number): boolean {
  return 0 <= a && a <= b && b <= text.length && 0 <= c && c <= d && d <= text.length && b - a === d - c
    && text.slice(a, b) === text.slice(c, d);
}

function wordStart(text: string, j: number, steps: number): number {
  //@ decreases steps
  return steps > 0 && isWordAt(text, j - 1) ? wordStart(text, j - 1, steps - 1) : j;
}

function wordEnd(text: string, j: number, steps: number): number {
  //@ decreases steps
  return steps > 0 && isWordAt(text, j) ? wordEnd(text, j + 1, steps - 1) : j;
}

function wordBetween(text: string, from: number, to: number): string {
  return 0 <= from && from <= to && to <= text.length ? text.slice(from, to).toLowerCase() : "";
}

function luhn(text: string, s: number, j: number, twice: boolean): number {
  //@ decreases j + 1 - s
  if (j < s) return 0;
  if (!isDigitAt(text, j)) return luhn(text, s, j - 1, twice);
  return (twice ? doubled(digitValue(text, j)) : digitValue(text, j)) + luhn(text, s, j - 1, !twice);
}

function groupBefore(text: string, s: number, from: number, to: number): number {
  const at = s - (to - from);
  return to > from && isDigitAt(text, at - 1) && sameText(text, at, s, from, to) ? runStart(text, at - 1, 20) : -1;
}

function groupAfter(text: string, q: number, from: number, to: number): number {
  const at = q + (to - from);
  return to > from && isDigitAt(text, at) && sameText(text, q, at, from, to) ? runEnd(text, at, 20) : -1;
}

function standsAlone(text: string, s: number, q: number, from: number, to: number): boolean {
  const before = groupBefore(text, s, from, to);
  const after = groupAfter(text, q, from, to);
  return (before < 0 || groupBefore(text, before, from, to) < 0) && (after < 0 || groupAfter(text, after, from, to) < 0);
}

function opensCard(text: string, s: number): boolean {
  const first = digitValue(text, s);
  const second = digitValue(text, isDigitAt(text, s + 1) ? s + 1 : gapEnd(text, s + 1, 6));
  return (first >= 3 && first <= 6) || (first === 2 && second >= 2 && second <= 7);
}

function namesCard(text: string, j: number, steps: number): boolean {
  //@ decreases steps
  if (steps <= 0 || j < 0 || isDigitAt(text, j) || endsSentenceAt(text, j)) return false;
  if (!isLetterAt(text, j)) return namesCard(text, j - 1, steps - 1);
  const start = wordStart(text, j, 12);
  const word = wordBetween(text, start, j + 1);
  return word === "card" || word === "cards" || word === "visa" || word === "mastercard" || word === "amex"
    || word === "discover" || word === "credit" || word === "debit" || namesCard(text, start - 1, steps - 1);
}

function cardShaped(named: boolean, groups: number, firstLength: number, secondLength: number, allFour: boolean, last: number, total: number): boolean {
  return total >= 13 && total <= 19
    && (named || groups === 0 || (allFour && groups >= 3 && last <= 4)
      || (groups === 2 && firstLength === 4 && secondLength === 6 && (last === 4 || last === 5))
      || (groups === 1 && firstLength === 6 && last === 13));
}

function cardEndsFrom(text: string, i: number, s: number, named: boolean, p: number, from: number, to: number, count: number, groups: number, firstLength: number, secondLength: number, allFour: boolean, steps: number): boolean {
  //@ decreases steps
  const q = runEnd(text, p, 20);
  const total = count + q - p;
  if (isDigitAt(text, q) || total > 19) return false;
  if (i < q && (groups > 0 || !(markedBefore(text, s) || markedAfter(text, q))) && cardShaped(named, groups, firstLength, secondLength, allFour, q - p, total)
    && luhn(text, s, q - 1, false) % 10 === 0 && standsAlone(text, s, q, from, to)) return true;
  const next = gapEnd(text, q, 6);
  const gapFrom = groups === 0 ? q : from;
  const gapTo = groups === 0 ? next : to;
  return steps > 0 && isDigitAt(text, next) && sameText(text, q, next, gapFrom, gapTo)
    && cardEndsFrom(text, i, s, named, next, gapFrom, gapTo, total, groups + 1, groups === 0 ? q - p : firstLength, groups === 1 ? q - p : secondLength, allFour && q - p === 4, steps - 1);
}

function cardStartsBack(text: string, i: number, s: number, steps: number): boolean {
  //@ decreases steps
  if (isDigitAt(text, s - 1)) return false;
  if (opensCard(text, s) && cardEndsFrom(text, i, s, namesCard(text, s - 1, 32), s, 0, 0, 0, 0, 0, 0, true, 19)) return true;
  const gap = gapStart(text, s, 6);
  return steps > 0 && gap < s && isDigitAt(text, gap - 1) && cardStartsBack(text, i, runStart(text, gap - 1, 20), steps - 1);
}

function isCardDigit(text: string, i: number): boolean {
  return isDigitAt(text, i) && cardStartsBack(text, i, runStart(text, i, 20), 19);
}

function codeCue(word: string): number {
  if (word === "cvv" || word === "cvc" || word === "cvv2" || word === "cvc2" || word === "csc") return 3;
  return word === "code" || word === "codes" || word === "pin" || word === "pins" || word === "otp" || word === "otps"
    || word === "passcode" || word === "passcodes" || word === "password" || word === "passwords"
    || word === "verification" || word === "verify" ? 4 : 0;
}

function wordBefore(text: string, start: number): string {
  const end = isSpaceAt(text, start - 1) || charAt(text, start - 1) === 45 ? start - 1 : 0;
  return end > 0 && isLetterAt(text, end - 1) ? wordBetween(text, wordStart(text, end, 12), end) : "";
}

function cueAt(text: string, start: number, end: number): number {
  const word = wordBetween(text, start, end);
  if (word !== "code" && word !== "codes") return codeCue(word);
  const before = wordBefore(text, start);
  return before === "zip" || before === "postal" || before === "area" || before === "country" ? 0 : before === "security" ? 3 : 4;
}

function isFiller(word: string): boolean {
  return word === "is" || word === "was" || word === "are" || word === "number" || word === "no";
}

function cueBefore(text: string, j: number, words: number, numbers: boolean, lines: boolean, sentences: boolean, steps: number): number {
  //@ decreases steps
  if (steps <= 0 || j < 0 || (!sentences && endsSentenceAt(text, j)) || (!lines && charAt(text, j) === 10)) return 0;
  if (!isWordAt(text, j)) return cueBefore(text, j - 1, words, numbers, lines, sentences, steps - 1);
  const start = wordStart(text, j, 16);
  if (!isLetterAt(text, start)) return numbers && words > 0 ? cueBefore(text, start - 1, words - 1, numbers, lines, sentences, steps - 1) : 0;
  const cue = cueAt(text, start, j + 1);
  if (cue > 0) return cue;
  if (isFiller(wordBetween(text, start, j + 1))) return cueBefore(text, start - 1, words, numbers, lines, sentences, steps - 1);
  return words > 0 ? cueBefore(text, start - 1, words - 1, numbers, lines, sentences, steps - 1) : 0;
}

function cueAfter(text: string, j: number, words: number, steps: number): boolean {
  //@ decreases steps
  if (steps <= 0 || j >= text.length || endsSentenceAt(text, j)) return false;
  if (!isWordAt(text, j)) return cueAfter(text, j + 1, words, steps - 1);
  const end = wordEnd(text, j, 16);
  return isLetterAt(text, j) && (cueAt(text, j, end) > 0 || (words > 0 && cueAfter(text, end, words - 1, steps - 1)));
}

function followsVerb(text: string, s: number): boolean {
  const word = charAt(text, s - 1) === 32 && isLetterAt(text, s - 2) ? wordBetween(text, wordStart(text, s - 1, 12), s - 1) : "";
  return word === "enter" || word === "type" || word === "use" || word === "input" || word === "key";
}

function followsColon(text: string, j: number, steps: number): boolean {
  //@ decreases steps
  if (charAt(text, j) === 58) return true;
  return steps > 0 && isSpaceAt(text, j) && followsColon(text, j - 1, steps - 1);
}

function endsLine(text: string, e: number): boolean {
  const c = charAt(text, e);
  return c < 0 || c === 10 || c === 13 || endsSentenceAt(text, e);
}

function blankBack(text: string, j: number, steps: number): boolean {
  //@ decreases steps
  if (j < 0 || charAt(text, j) === 10) return true;
  return steps > 0 && isSpaceAt(text, j) && blankBack(text, j - 1, steps - 1);
}

function blankAhead(text: string, j: number, steps: number): boolean {
  //@ decreases steps
  if (j >= text.length || charAt(text, j) === 10) return true;
  return steps > 0 && isSpaceAt(text, j) && blankAhead(text, j + 1, steps - 1);
}

function attachedBefore(text: string, s: number): boolean {
  const c = charAt(text, s - 1);
  return isLetterAt(text, s - 1) || c === 35 || c === 36 || c === 43 || c === 163 || c === 8364 || markedBefore(text, s);
}

function attachedAfter(text: string, e: number): boolean {
  return isLetterAt(text, e) || charAt(text, e) === 37 || markedAfter(text, e);
}

function codeFrom(text: string, i: number, s: number): boolean {
  if (isDigitAt(text, s - 1) || attachedBefore(text, s)) return false;
  const q = runEnd(text, s, 13);
  const second = isCodeJoinAt(text, q) && isDigitAt(text, q + 1) ? runEnd(text, q + 1, 13) : q;
  const pair = second - q - 1 === q - s && (q - s === 3 || q - s === 4);
  const e = pair ? second : q;
  const length = pair ? 2 * (q - s) : q - s;
  if (i >= e || isDigitAt(text, e) || attachedAfter(text, e) || length < 3 || length > 12) return false;
  const tight = cueBefore(text, s - 1, 0, false, true, false, 40);
  if (tight > 0 && length >= tight) return true;
  const year = length === 4 && ((digitValue(text, s) === 1 && digitValue(text, s + 1) === 9) || (digitValue(text, s) === 2 && digitValue(text, s + 1) === 0));
  return length >= 4 && !year && ((followsVerb(text, s) && length >= 6 && length <= 8)
    || cueAfter(text, e, 8, 120)
    || ((followsColon(text, s - 1, 8) || endsLine(text, e)) && cueBefore(text, s - 1, 12, true, false, false, 160) > 0)
    || (blankBack(text, s - 1, 8) && blankAhead(text, e, 8) && cueBefore(text, s - 1, 40, false, true, true, 300) > 0));
}

function isCodeDigit(text: string, i: number): boolean {
  if (!isDigitAt(text, i)) return false;
  const s = runStart(text, i, 13);
  const first = isCodeJoinAt(text, s - 1) && isDigitAt(text, s - 2) ? runStart(text, s - 1, 13) : s;
  return codeFrom(text, i, s) || (first < s && codeFrom(text, i, first));
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
