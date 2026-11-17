//@ backend dafny
// spec/app/conversation.md, "Detected private content is removed before the conversation continues"

export interface Leaving { text: string; passwords: string[] }

function charAt(text: string, i: number): number {
  return 0 <= i && i < text.length ? text.charCodeAt(i) : -1;
}

function isDigitAt(text: string, i: number): boolean {
  const c = charAt(text, i);
  return (c >= 48 && c <= 57) || (c >= 65296 && c <= 65305);
}

function isLetterAt(text: string, i: number): boolean {
  const c = charAt(text, i);
  return (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 192 && c <= 591 && c !== 215 && c !== 247);
}

function isStarredAt(text: string, i: number): boolean {
  return charAt(text, i) === 42 && ((charAt(text, i - 1) === 42 && (charAt(text, i - 2) === 42 || charAt(text, i + 1) === 42))
    || (charAt(text, i + 1) === 42 && charAt(text, i + 2) === 42));
}

function isWordAt(text: string, i: number): boolean {
  return isLetterAt(text, i) || isDigitAt(text, i) || isStarredAt(text, i);
}

function isSpaceAt(text: string, i: number): boolean {
  const c = charAt(text, i);
  return c === 32 || c === 9 || c === 10 || c === 13 || c === 160;
}

function isCardGapAt(text: string, i: number): boolean {
  const c = charAt(text, i);
  return isSpaceAt(text, i) || c === 44 || c === 45 || c === 46 || c === 47 || c === 95 || c === 124
    || c === 8199 || c === 8201 || c === 8239 || c === 8208 || c === 8209 || c === 8211 || c === 8722
    || c === 8203 || c === 8204 || c === 8205 || c === 8288 || c === 65279 || c === 88 || c === 120;
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
  const c = charAt(text, i);
  return c >= 65296 && c <= 65305 ? c - 65296 : c >= 48 && c <= 57 ? c - 48 : 0;
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

function breaksAt(text: string, j: number, to: number, steps: number): boolean {
  //@ decreases steps
  return steps > 0 && j < to && (charAt(text, j) === 10 || charAt(text, j) === 13 || breaksAt(text, j + 1, to, steps - 1));
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

function fourBefore(text: string, s: number, broken: boolean, steps: number): number {
  //@ decreases steps
  const gap = gapStart(text, s, 6);
  const start = runStart(text, gap, 20);
  return steps > 0 && gap < s && breaksAt(text, gap, s, 6) === broken && gap - start === 4 && !isDigitAt(text, start - 1)
    ? 1 + fourBefore(text, start, broken, steps - 1) : 0;
}

function fourAfter(text: string, q: number, broken: boolean, steps: number): number {
  //@ decreases steps
  const next = gapEnd(text, q, 6);
  const end = runEnd(text, next, 20);
  return steps > 0 && next > q && breaksAt(text, q, next, 6) === broken && end - next === 4 && !isDigitAt(text, end)
    ? 1 + fourAfter(text, end, broken, steps - 1) : 0;
}

function aligned(before: number, after: number): boolean {
  return before % 4 + after % 4 <= 1 || (before <= 1 && after <= 1);
}

function decimalBefore(text: string, s: number): boolean {
  return charAt(text, s - 1) === 46 && isDigitAt(text, s - 2);
}

function opensCard(text: string, s: number): boolean {
  const first = digitValue(text, s);
  const second = digitValue(text, isDigitAt(text, s + 1) ? s + 1 : gapEnd(text, s + 1, 6));
  return first === 1 || (first >= 3 && first <= 6) || (first === 2 && second >= 2 && second <= 7);
}

function isCardWord(word: string): boolean {
  return word === "card" || word === "cards" || word === "visa" || word === "mastercard" || word === "amex"
    || word === "discover" || word === "credit" || word === "debit";
}

function namesCard(text: string, j: number, steps: number): boolean {
  //@ decreases steps
  if (steps <= 0 || j < 0 || isDigitAt(text, j) || endsSentenceAt(text, j)) return false;
  if (!isLetterAt(text, j)) return namesCard(text, j - 1, steps - 1);
  const start = wordStart(text, j, 12);
  return isCardWord(wordBetween(text, start, j + 1)) || namesCard(text, start - 1, steps - 1);
}

function namesCardAfter(text: string, j: number, words: number, steps: number): boolean {
  //@ decreases steps
  if (steps <= 0 || j >= text.length || isDigitAt(text, j) || endsSentenceAt(text, j)) return false;
  if (!isLetterAt(text, j)) return namesCardAfter(text, j + 1, words, steps - 1);
  const end = wordEnd(text, j, 16);
  return isCardWord(wordBetween(text, j, end)) || (words > 0 && namesCardAfter(text, end, words - 1, steps - 1));
}

function isolated(text: string, s: number, q: number): boolean {
  const before = gapStart(text, s, 6);
  const after = gapEnd(text, q, 6);
  return !(before < s && before - runStart(text, before, 20) >= 3) && !(after > q && runEnd(text, after, 20) - after >= 3);
}

function tailEnd(text: string, q: number, steps: number): number {
  //@ decreases steps
  const next = gapEnd(text, q, 6);
  const end = runEnd(text, next, 5);
  return steps > 0 && next > q && !breaksAt(text, q, next, 6) && isDigitAt(text, next) && end - next <= 4 && !isDigitAt(text, end) && !isLetterAt(text, end)
    ? tailEnd(text, end, steps - 1) : q;
}

function cardEndsFrom(text: string, i: number, s: number, named: boolean, broken: boolean, p: number, count: number, groups: number, first: number, second: number, shortest: number, longest: number, allFour: boolean, sep: number, steps: number): boolean {
  //@ decreases steps
  const q = runEnd(text, p, 20);
  const total = count + q - p;
  const low = groups === 0 || q - p < shortest ? q - p : shortest;
  const high = q - p > longest ? q - p : longest;
  if (isDigitAt(text, q) || total > 19) return false;
  if (total >= 13 && (digitValue(text, s) !== 1 || total === 15) && i < tailEnd(text, q, 3) && luhn(text, s, q - 1, false) % 10 === 0
    && (named || groups === 0
      || (allFour && groups >= 3 && q - p <= 4 && aligned(fourBefore(text, s, broken, 19), fourAfter(text, q, broken, 19)))
      || (groups === 2 && first === 4 && second === 6 && (q - p === 4 || q - p === 5))
      || (groups === 1 && first === 6 && q - p === 13)
      || (groups <= 3 && low >= 3 && high <= 13 && (low < high || groups === 1) && sep > 0 && sep !== 44 && isolated(text, s, tailEnd(text, q, 3)))
      || namesCardAfter(text, q, 4, 40))) return true;
  const next = gapEnd(text, q, 6);
  const breaks = breaksAt(text, q, next, 6);
  return steps > 0 && next > q && isDigitAt(text, next) && (named || groups === 0 || breaks === broken)
    && cardEndsFrom(text, i, s, named, groups === 0 ? breaks : broken, next, total, groups + 1, groups === 0 ? q - p : first, groups === 1 ? q - p : second, low, high, allFour && q - p === 4,
      groups === 0 || charAt(text, q) === sep ? charAt(text, q) : -1, steps - 1);
}

function cardStartsBack(text: string, i: number, s: number, steps: number): boolean {
  //@ decreases steps
  if (isDigitAt(text, s - 1)) return false;
  if (opensCard(text, s) && !decimalBefore(text, s) && cardEndsFrom(text, i, s, namesCard(text, s - 1, 32), false, s, 0, 0, 0, 0, 0, 0, true, 0, 19)) return true;
  const gap = gapStart(text, s, 6);
  return steps > 0 && gap < s && isDigitAt(text, gap - 1) && cardStartsBack(text, i, runStart(text, gap - 1, 20), steps - 1);
}

function isCardDigit(text: string, i: number): boolean {
  return isDigitAt(text, i) && cardStartsBack(text, i, runStart(text, i, 20), 19);
}

function codeCue(word: string): number {
  if (word === "cvv" || word === "cvc" || word === "cvv2" || word === "cvc2" || word === "csc" || word === "cid") return 3;
  if (word === "enter" || word === "type" || word === "input" || word === "key") return 6;
  return word === "code" || word === "codes" || word === "pin" || word === "pins" || word === "otp" || word === "otps"
    || word === "passcode" || word === "passcodes" || word === "password" || word === "passwords"
    || word === "verification" || word === "verify" || word === "authentication" || word === "token" || word === "tokens"
    || word === "routing" || word === "ssn" || word === "texted" || word === "codigo" || word === "c\u00f3digo"
    || word === "verificacion" || word === "verificaci\u00f3n" || word === "contrasena" || word === "contrase\u00f1a" || word === "clave" ? 4 : 0;
}

function meets(cue: number, length: number): boolean {
  return cue > 0 && length >= cue;
}

function wordBefore(text: string, start: number): string {
  const end = isSpaceAt(text, start - 1) || charAt(text, start - 1) === 45 ? start - 1 : 0;
  return end > 0 && isLetterAt(text, end - 1) ? wordBetween(text, wordStart(text, end, 12), end) : "";
}

function cueAt(text: string, start: number, end: number): number {
  const word = wordBetween(text, start, end);
  const before = word === "code" || word === "codes" || word === "number" ? wordBefore(text, start) : "";
  if (word === "number") return before === "time" || before === "account" || before === "routing" || before === "security" || before === "in" ? 4 : 0;
  if (word !== "code" && word !== "codes") return codeCue(word);
  return before === "zip" || before === "postal" || before === "area" || before === "country" || before === "promo" || before === "coupon"
    || before === "discount" || before === "referral" ? 0 : before === "security" ? 3 : 4;
}

function isFiller(word: string): boolean {
  return word === "is" || word === "was" || word === "are" || word === "number" || word === "no" || word === "it" || word === "s"
    || word === "its" || word === "here" || word === "the" || word === "your" || word === "my" || word === "this" || word === "be"
    || word === "will" || word === "now" || word === "again" || word === "just" || word === "on" || word === "back";
}

function cueBefore(text: string, j: number, words: number, numbers: boolean, lines: boolean, sentences: boolean, steps: number): number {
  //@ decreases steps
  if (steps <= 0 || j < 0 || (!sentences && endsSentenceAt(text, j)) || (!lines && charAt(text, j) === 10)) return 0;
  if (!isWordAt(text, j)) return cueBefore(text, j - 1, words, numbers, lines, sentences, steps - 1);
  const start = wordStart(text, j, 16);
  if (!isLetterAt(text, start)) return numbers && words > 0 ? cueBefore(text, start - 1, words - 1, numbers, lines, sentences, steps - 1) : 0;
  const cue = cueAt(text, start, j + 1);
  if (cue > 4 && numbers) {
    const behind = words > 0 ? cueBefore(text, start - 1, words - 1, numbers, lines, sentences, steps - 1) : 0;
    return behind > 0 ? behind : cue;
  }
  if (cue > 0) return cue;
  if (isFiller(wordBetween(text, start, j + 1))) return cueBefore(text, start - 1, words, numbers, lines, sentences, steps - 1);
  return words > 0 ? cueBefore(text, start - 1, words - 1, numbers, lines, sentences, steps - 1) : 0;
}

function cueAfter(text: string, j: number, words: number, lines: boolean, steps: number): number {
  //@ decreases steps
  if (steps <= 0 || j >= text.length || endsSentenceAt(text, j) || (!lines && charAt(text, j) === 10)) return 0;
  if (!isWordAt(text, j)) return cueAfter(text, j + 1, words, lines, steps - 1);
  const end = wordEnd(text, j, 16);
  const cue = isLetterAt(text, j) ? cueAt(text, j, end) : 0;
  return cue > 0 && cue <= 4 ? cue : isLetterAt(text, j) && words > 0 ? cueAfter(text, end, words - 1, lines, steps - 1) : 0;
}

function wordAfter(text: string, e: number): string {
  return charAt(text, e) === 32 && isLetterAt(text, e + 1) ? wordBetween(text, e + 1, wordEnd(text, e + 1, 12)) : "";
}

function skipBack(text: string, j: number, steps: number): number {
  //@ decreases steps
  return steps > 0 && j > 0 && !isWordAt(text, j - 1) && charAt(text, j - 1) !== 10 ? skipBack(text, j - 1, steps - 1) : j;
}

function dialledAt(text: string, s: number): boolean {
  const end = skipBack(text, s, 3);
  const word = isLetterAt(text, end - 1) ? wordBetween(text, wordStart(text, end, 12), end) : "";
  return word === "call" || word === "calling" || word === "called" || word === "at" || word === "to" || word === "dial"
    || word === "text" || word === "texted" || word === "phone" || word === "tel" || word === "fax" || word === "cell"
    || word === "mobile" || word === "ending" || word === "ends" || word === "ext" || word === "extension";
}

function followsColon(text: string, j: number, steps: number): boolean {
  //@ decreases steps
  if (charAt(text, j) === 58) return true;
  return steps > 0 && (isSpaceAt(text, j) || isDigitAt(text, j)) && followsColon(text, j - 1, steps - 1);
}

function endsLine(text: string, e: number): boolean {
  const c = charAt(text, e);
  return c < 0 || c === 10 || c === 13 || endsSentenceAt(text, e);
}

function isMarkupAt(text: string, i: number): boolean {
  const c = charAt(text, i);
  return isSpaceAt(text, i) || c === 42 || c === 95 || c === 96 || c === 34 || c === 39;
}

function blankBack(text: string, j: number, steps: number): boolean {
  //@ decreases steps
  if (j < 0 || charAt(text, j) === 10) return true;
  const c = charAt(text, j);
  return steps > 0 && (isMarkupAt(text, j) || isDigitAt(text, j) || c === 45 || c === 62 || c === 35 || c === 43 || c === 46 || c === 41 || c === 124 || c === 8226)
    && blankBack(text, j - 1, steps - 1);
}

function blankAhead(text: string, j: number, steps: number): boolean {
  //@ decreases steps
  if (j >= text.length || charAt(text, j) === 10) return true;
  return steps > 0 && (isMarkupAt(text, j) || charAt(text, j) === 46 || charAt(text, j) === 124) && blankAhead(text, j + 1, steps - 1);
}

function attachedBefore(text: string, s: number): boolean {
  const c = charAt(text, s - 1);
  return isLetterAt(text, s - 1) || c === 36 || c === 43 || c === 163 || c === 8364 || markedBefore(text, s);
}

function attachedAfter(text: string, e: number): boolean {
  return isLetterAt(text, e) || charAt(text, e) === 37 || markedAfter(text, e);
}

function runsOn(text: string, s: number, e: number, group: number): boolean {
  const before = (charAt(text, s - 1) === 32 || charAt(text, s - 1) === 160) && isDigitAt(text, s - 2) ? s - 1 - runStart(text, s - 1, 13) : group;
  const after = (charAt(text, e) === 32 || charAt(text, e) === 160) && isDigitAt(text, e + 1) ? runEnd(text, e + 1, 13) - e - 1 : group;
  return (group === 3 && after === 4) || (group === 4 && before === 3);
}

function codeFrom(text: string, i: number, s: number): boolean {
  if (isDigitAt(text, s - 1) || attachedBefore(text, s)) return false;
  const q = runEnd(text, s, 13);
  const second = isCodeJoinAt(text, q) && isDigitAt(text, q + 1) ? runEnd(text, q + 1, 13) : q;
  const pair = second - q - 1 === q - s && (q - s === 3 || q - s === 4);
  const e = pair ? second : q;
  const length = pair ? 2 * (q - s) : q - s;
  if (i >= e || isDigitAt(text, e) || attachedAfter(text, e) || length < 3 || length > 12 || runsOn(text, s, e, pair ? q - s : length)) return false;
  const said = wordBefore(text, s);
  const tight = cueBefore(text, s - 1, 0, false, true, false, 40);
  const dialable = length === 7 || length === 10 || (length === 11 && digitValue(text, s) === 1);
  if (!dialable && (meets(tight, length) || (tight === 4 && length === 3 && (said === "is" || said === "was")))) return true;
  if (charAt(text, s - 1) === 35 || dialledAt(text, s)) return false;
  const alone = blankBack(text, s - 1, 24) && blankAhead(text, e, 24);
  if (length >= 4 && alone && meets(cueBefore(text, s - 1, 120, true, true, true, 900), length)) return true;
  const year = length === 4 && ((digitValue(text, s) === 1 && digitValue(text, s + 1) === 9) || (digitValue(text, s) === 2 && digitValue(text, s + 1) === 0));
  const next = wordAfter(text, e);
  if ((!year || next === "is") && meets(cueAfter(text, e, 2, alone, 40), length)) return true;
  const after = cueAfter(text, e, 12, alone, 160);
  if (meets(after, length) && length !== 4) return true;
  return length >= 4 && !year && ((after > 0 && length === 4)
    || ((followsColon(text, s - 1, 40) || endsLine(text, e)) && meets(cueBefore(text, s - 1, 12, true, false, true, 160), length))
    || ((said === "is" || said === "was" || said === "are") && meets(cueBefore(text, s - 1, 40, true, false, false, 300), length))
    || ((next === "is" || next === "was") && meets(cueBefore(text, s - 1, 40, true, true, true, 300), length)));
}

function isCodeDigit(text: string, i: number): boolean {
  if (!isDigitAt(text, i)) return false;
  const s = runStart(text, i, 13);
  const first = isCodeJoinAt(text, s - 1) && isDigitAt(text, s - 2) ? runStart(text, s - 1, 13) : s;
  return codeFrom(text, i, s) || (first < s && codeFrom(text, i, first));
}

function isJoinAt(text: string, i: number): boolean {
  const c = charAt(text, i);
  return c === 32 || c === 44 || c === 45 || (c === 46 && !isSpaceAt(text, i + 1)) || c === 160 || c === 8209 || c === 8211;
}

function joinStart(text: string, j: number, steps: number): number {
  //@ decreases steps
  return steps > 0 && isJoinAt(text, j - 1) ? joinStart(text, j - 1, steps - 1) : j;
}

function joinEnd(text: string, j: number, steps: number): number {
  //@ decreases steps
  return steps > 0 && isJoinAt(text, j) ? joinEnd(text, j + 1, steps - 1) : j;
}

function chainStart(text: string, s: number, steps: number): number {
  //@ decreases steps
  const gap = joinStart(text, s, 3);
  const start = runStart(text, gap, 9);
  return steps > 0 && gap < s && isDigitAt(text, gap - 1) && !isDigitAt(text, start - 1) ? chainStart(text, start, steps - 1) : s;
}

function chainEnd(text: string, p: number, steps: number): number {
  //@ decreases steps
  const q = runEnd(text, p, 9);
  const next = joinEnd(text, q, 3);
  return steps > 0 && next > q && isDigitAt(text, next) && !isDigitAt(text, runEnd(text, next, 9)) ? chainEnd(text, next, steps - 1) : q;
}

function digitsBetween(text: string, j: number, e: number, steps: number): number {
  //@ decreases steps
  return steps > 0 && j < e ? (isDigitAt(text, j) ? 1 : 0) + digitsBetween(text, j + 1, e, steps - 1) : 0;
}

function evenFrom(text: string, p: number, e: number, width: number, steps: number): boolean {
  //@ decreases steps
  const q = runEnd(text, p, 9);
  const join = charAt(text, q);
  return q - p === width && (q >= e || (steps > 0 && (width >= 3 || (join !== 44 && join !== 46)) && evenFrom(text, joinEnd(text, q, 3), e, width, steps - 1)));
}

function isChainCodeDigit(text: string, i: number): boolean {
  if (!isDigitAt(text, i)) return false;
  const s = chainStart(text, runStart(text, i, 9), 8);
  const e = chainEnd(text, s, 8);
  if (isDigitAt(text, s - 1) || i >= e || e === runEnd(text, s, 9) || attachedBefore(text, s) || isLetterAt(text, e)) return false;
  return evenFrom(text, s, e, runEnd(text, s, 9) - s, 8) && meets(cueBefore(text, s - 1, 0, false, true, false, 40), digitsBetween(text, s, e, 48));
}

function isCodeCharAt(text: string, i: number): boolean {
  const c = charAt(text, i);
  return (c >= 48 && c <= 57) || (c >= 65 && c <= 90);
}

function codeCharStart(text: string, j: number, steps: number): number {
  //@ decreases steps
  return steps > 0 && isCodeCharAt(text, j - 1) ? codeCharStart(text, j - 1, steps - 1) : j;
}

function codeCharEnd(text: string, j: number, steps: number): number {
  //@ decreases steps
  return steps > 0 && isCodeCharAt(text, j) ? codeCharEnd(text, j + 1, steps - 1) : j;
}

function spelled(text: string, j: number, e: number, run: number, steps: number): boolean {
  //@ decreases steps
  return run >= 3 || (steps > 0 && j < e && spelled(text, j + 1, e, isLetterAt(text, j) ? run + 1 : 0, steps - 1));
}

function isLetteredCodeAt(text: string, i: number): boolean {
  if (!isCodeCharAt(text, i)) return false;
  const s = codeCharStart(text, i, 13);
  const e = codeCharEnd(text, i, 13);
  if (e - s < 5 || e - s > 12 || isWordAt(text, s - 1) || isWordAt(text, e)) return false;
  const digits = digitsBetween(text, s, e, 13);
  return digits * 2 >= e - s && digits < e - s && !spelled(text, s, e, 0, 13) && cueBefore(text, s - 1, 0, false, true, false, 40) > 0;
}

function ssnFrom(text: string, i: number, s: number): boolean {
  const join = charAt(text, s + 3);
  return (join === 45 || join === 32) && s <= i && i < s + 11 && !isDigitAt(text, s - 1) && !isLetterAt(text, s - 1) && !markedBefore(text, s)
    && runEnd(text, s, 4) === s + 3 && runEnd(text, s + 4, 3) === s + 6 && charAt(text, s + 6) === join && runEnd(text, s + 7, 5) === s + 11
    && !isLetterAt(text, s + 11) && !markedAfter(text, s + 11);
}

function isSsnDigit(text: string, i: number): boolean {
  const s = runStart(text, i, 5);
  return isDigitAt(text, i) && (ssnFrom(text, i, s) || ssnFrom(text, i, s - 4) || ssnFrom(text, i, s - 7));
}

function tokenStart(text: string, j: number, steps: number): number {
  //@ decreases steps
  return steps > 0 && j > 0 && !isSpaceAt(text, j - 1) ? tokenStart(text, j - 1, steps - 1) : j;
}

function tokenEnd(text: string, j: number, steps: number): number {
  //@ decreases steps
  return steps > 0 && j < text.length && !isSpaceAt(text, j) ? tokenEnd(text, j + 1, steps - 1) : j;
}

function spaceStart(text: string, j: number, steps: number): number {
  //@ decreases steps
  const c = charAt(text, j - 1);
  return steps > 0 && (c === 32 || c === 9 || c === 160) ? spaceStart(text, j - 1, steps - 1) : j;
}

function isClosingAt(text: string, i: number): boolean {
  const c = charAt(text, i);
  return c === 46 || c === 44 || c === 33 || c === 63 || c === 59 || c === 58 || c === 41 || c === 34 || c === 39;
}

function strongFrom(text: string, s: number, j: number, e: number, steps: number): boolean {
  //@ decreases steps
  if (steps <= 0 || j >= e) return false;
  const c = charAt(text, j);
  return !isLetterAt(text, j) || (j > s && c >= 65 && c <= 90) || strongFrom(text, s, j + 1, e, steps - 1);
}

function wordEndingAt(text: string, end: number): string {
  return wordBetween(text, wordStart(text, end, 16), end);
}

function isStatedAt(text: string, i: number): boolean {
  if (i < 0 || i >= text.length || isSpaceAt(text, i)) return false;
  const s = tokenStart(text, i, 64);
  const end = tokenEnd(text, i, 64);
  const e = end - 1 > s && isClosingAt(text, end - 1) ? end - 1 : end;
  const gap = spaceStart(text, s, 8);
  if (gap === s || i >= e) return false;
  const labelled = charAt(text, gap - 1) === 58 || charAt(text, gap - 1) === 61;
  const w = labelled ? spaceStart(text, gap - 1, 8) : gap;
  const said = wordEndingAt(text, w);
  const cue = said === "is" || said === "was" ? wordEndingAt(text, spaceStart(text, wordStart(text, w, 16), 8)) : said;
  return (cue === "password" || cue === "passcode" || cue === "passphrase" || cue === "pwd") && (labelled || strongFrom(text, s, s, e, 64));
}

function foldAt(text: string, i: number): number {
  const c = charAt(text, i);
  return c >= 65 && c <= 90 ? c + 32 : c;
}

function matchesFrom(text: string, word: string, at: number, k: number): boolean {
  //@ decreases word.length - k
  return k >= word.length || (foldAt(text, at + k) === foldAt(word, k) && matchesFrom(text, word, at, k + 1));
}

function occursAt(text: string, word: string, at: number): boolean {
  return word.length > 0 && 0 <= at && at + word.length <= text.length && foldAt(text, at) === foldAt(word, 0) && matchesFrom(text, word, at, 1);
}

function covers(text: string, word: string, i: number, back: number): boolean {
  //@ decreases word.length - back
  if (back < 0 || back >= word.length) return false;
  return occursAt(text, word, i - back) || covers(text, word, i, back + 1);
}

function isDetectedAt(text: string, i: number): boolean {
  return isCardDigit(text, i) || isCodeDigit(text, i) || isChainCodeDigit(text, i) || isLetteredCodeAt(text, i)
    || isSsnDigit(text, i) || isStatedAt(text, i);
}

export function isPrivateAt(text: string, passwords: string[], i: number): boolean {
  return isDetectedAt(text, i) || passwords.some((word) => word.length >= 4 && covers(text, word, i, 0));
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
    out = out + (isDetectedAt(text, i) || hidesPassword(text, passwords, i) ? "*" : text.slice(i, i + 1));
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
