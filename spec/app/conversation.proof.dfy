lemma HistoryKeepsNewest(c: Conversation)
  ensures |sentHistory(c)| == (if |c.messages| < historyMessages then |c.messages| else historyMessages)
  ensures |c.messages| > 0 ==> sentHistory(c)[|sentHistory(c)| - 1] == c.messages[|c.messages| - 1]
  decreases |c.messages|
{
  if |c.messages| > 0 {
    var earlier := c.(messages := c.messages[..|c.messages| - 1]);
    var last := c.messages[|c.messages| - 1];
    assert c.messages == earlier.messages + [last];
    HistoryKeepsNewest(earlier);
    ProofLib.FoldLeftAppend((kept: seq<Message>, m: Message) => ((if (|kept| < historyMessages) then kept else kept[1..]) + [m]), [], earlier.messages, last);
  }
}

lemma lawHistoryWindowIsBounded_ensures(c: Conversation)
  ensures (lawHistoryWindowIsBounded(c) == true)
{
  HistoryKeepsNewest(c);
}
