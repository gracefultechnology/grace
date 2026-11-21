// spec/app/conversation.md, "Story: Talk or type without losing the conversation"
lemma turnText_ensures(lines: seq<string>, last: string, limit: int)
  requires (limit >= 0)
  ensures (|turnText(lines, last, limit).text| <= limit)
  ensures (0 <= turnText(lines, last, limit).kept)
  ensures (turnText(lines, last, limit).kept <= |lines|)
  ensures ((|last| <= limit) ==> (turnText(lines, last, limit).text == (if (turnText(lines, last, limit).kept == 0) then last else ((joined(lines, turnText(lines, last, limit).kept) + "\n\n") + last))))
{
  fitting_ensures(lines, |lines|, (limit - |last|) - 2);
}
