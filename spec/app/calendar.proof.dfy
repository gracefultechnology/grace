lemma CalendarUpsertFilterView(entries: seq<Calendar>, incoming: Calendar)
  ensures upsertOccurrence(entries, incoming) ==
    (if admissibleOccurrence(entries, incoming) then
      ProofLib.Filter((c: Calendar) => !(sameOccurrence(c, incoming)), entries) + [incoming]
    else entries)
  ensures lawUpsertLeavesOne(entries, incoming) ==
    (!admissibleOccurrence(entries, incoming) ||
      |ProofLib.Filter((c: Calendar) => sameOccurrence(c, incoming), upsertOccurrence(entries, incoming))| == 1)
{
}

lemma lawUpsertLeavesOne_ensures(entries: seq<Calendar>, incoming: Calendar)
  ensures (lawUpsertLeavesOne(entries, incoming) == true)
{
  CalendarUpsertFilterView(entries, incoming);
  if admissibleOccurrence(entries, incoming) {
    var remaining := ProofLib.Filter((c: Calendar) => !(sameOccurrence(c, incoming)), entries);
    forall i | 0 <= i < |remaining|
      ensures !sameOccurrence(remaining[i], incoming)
    {
      ProofLib.FilterMember((c: Calendar) => !(sameOccurrence(c, incoming)), entries, remaining[i]);
    }
    ProofLib.FilterNone((c: Calendar) => sameOccurrence(c, incoming), remaining);
    ProofLib.FilterAppend((c: Calendar) => sameOccurrence(c, incoming), remaining, incoming);
    assert sameOccurrence(incoming, incoming);
  }
}
