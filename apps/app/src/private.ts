//@ backend dafny
// spec/app/conversation.md, "Detected private content is removed before the conversation continues"

export interface Leaving { text: string; passwords: string[] }

function isDigitAt(text: string, i: number): boolean {
  return 0 <= i && i < text.length && text.charCodeAt(i) >= 48 && text.charCodeAt(i) <= 57;
}

function isSeparatorAt(text: string, i: number): boolean {
  return 0 <= i && i < text.length && (text.charCodeAt(i) === 32 || text.charCodeAt(i) === 45);
}

function digitBefore(text: string, i: number): number {
  return isDigitAt(text, i - 1) ? i - 1 : isSeparatorAt(text, i - 1) && isDigitAt(text, i - 2) ? i - 2 : -1;
}

function digitAfter(text: string, i: number): number {
  return isDigitAt(text, i + 1) ? i + 1 : isSeparatorAt(text, i + 1) && isDigitAt(text, i + 2) ? i + 2 : -1;
}

function firstDigit(text: string, i: number, steps: number): number {
  //@ decreases steps
  if (digitBefore(text, i) < 0) return i;
  if (steps <= 0) return -1;
  return firstDigit(text, digitBefore(text, i), steps - 1);
}

function lastDigit(text: string, i: number, steps: number): number {
  //@ decreases steps
  if (digitAfter(text, i) < 0) return i;
  if (steps <= 0) return -1;
  return lastDigit(text, digitAfter(text, i), steps - 1);
}

function digitCount(text: string, last: number, steps: number): number {
  //@ decreases steps
  if (digitBefore(text, last) < 0 || steps <= 0) return 1;
  return 1 + digitCount(text, digitBefore(text, last), steps - 1);
}

function luhnSum(text: string, last: number, doubled: boolean, steps: number): number {
  //@ decreases steps
  const digit = isDigitAt(text, last) ? text.charCodeAt(last) - 48 : 0;
  const value = doubled ? (digit * 2 > 9 ? digit * 2 - 9 : digit * 2) : digit;
  if (digitBefore(text, last) < 0 || steps <= 0) return value;
  return value + luhnSum(text, digitBefore(text, last), !doubled, steps - 1);
}

function isCardDigit(text: string, i: number): boolean {
  if (!isDigitAt(text, i)) return false;
  const last = lastDigit(text, i, 18);
  if (last < 0) return false;
  const count = digitCount(text, last, 19);
  return count >= 13 && count <= 19 && luhnSum(text, last, false, 19) % 10 === 0;
}

function namesCode(words: string): boolean {
  const lower = words.toLowerCase();
  return lower.includes("code") || lower.includes("pin") || lower.includes("otp") || lower.includes("password");
}

function isCodeDigit(text: string, i: number): boolean {
  if (!isDigitAt(text, i)) return false;
  const first = firstDigit(text, i, 7);
  const last = lastDigit(text, i, 7);
  if (first < 0 || last < 0) return false;
  const count = digitCount(text, last, 8);
  return count >= 4 && count <= 8
    && (namesCode(text.slice(Math.max(0, first - 40), first)) || namesCode(text.slice(last + 1, Math.min(text.length, last + 41))));
}

function occursAt(text: string, word: string, at: number): boolean {
  return word.length > 0 && 0 <= at && at + word.length <= text.length && text.slice(at, at + word.length) === word;
}

function covers(text: string, word: string, i: number, back: number): boolean {
  //@ decreases word.length - back
  if (back < 0 || back >= word.length) return false;
  return occursAt(text, word, i - back) || covers(text, word, i, back + 1);
}

function isPrivateAt(text: string, passwords: string[], i: number): boolean {
  return isCardDigit(text, i) || isCodeDigit(text, i) || passwords.some((word) => covers(text, word, i, 0));
}

export function withhold(leaving: Leaving): string {
  //@ ensures \result.length === leaving.text.length
  //@ ensures forall(k, 0 <= k && k < leaving.text.length ==> (isPrivateAt(leaving.text, leaving.passwords, k) ? \result.charCodeAt(k) === 42 : \result.charCodeAt(k) === leaving.text.charCodeAt(k)))
  //@ ensures forall(k, 0 <= k && k < leaving.text.length ==> !isPrivateAt(leaving.text, leaving.passwords, k)) ==> \result === leaving.text
  //@ ensures forall(j, forall(at, 0 <= j && j < leaving.passwords.length && forall(k, 0 <= k && k < leaving.passwords[j].length ==> leaving.passwords[j].charCodeAt(k) !== 42) ==> !occursAt(\result, leaving.passwords[j], at)))
  const text = leaving.text;
  let out = "";
  let i = 0;
  while (i < text.length) {
    //@ invariant 0 <= i && i <= text.length
    //@ invariant out.length === i
    //@ invariant forall(k, 0 <= k && k < i ==> (isPrivateAt(text, leaving.passwords, k) ? out.charCodeAt(k) === 42 : out.charCodeAt(k) === text.charCodeAt(k)))
    out = out + (isPrivateAt(text, leaving.passwords, i) ? "*" : text.slice(i, i + 1));
    i = i + 1;
  }
  //@ assert forall(k, 0 <= k && k < text.length ==> !isPrivateAt(text, leaving.passwords, k)) ==> forall(k, 0 <= k && k < text.length ==> out[k] === text[k])
  //@ assert forall(j, forall(at, 0 <= j && j < leaving.passwords.length && forall(k, 0 <= k && k < leaving.passwords[j].length ==> leaving.passwords[j].charCodeAt(k) !== 42) && occursAt(out, leaving.passwords[j], at) ==> occursAt(text, leaving.passwords[j], at) && leaving.passwords[j].charCodeAt(0) !== 42))
  //@ assert forall(j, forall(at, 0 <= j && j < leaving.passwords.length && occursAt(text, leaving.passwords[j], at) ==> covers(text, leaving.passwords[j], at, 0)))
  return out;
}
