lemma lawRoutedMailNeverSendsOrDeletes_ensures(w: World, request: app__request_Request, command: AgentAction)
  ensures (lawRoutedMailNeverSendsOrDeletes(w, request, command) == true)
{
  var routed := route(w, request, command);
  if routed.ToMail? {
    GraceAssistKeepsSendingHers(app__mailboxes_sourceOf(w.mail, routed.account), routed.assist);
  }
}

lemma PutMessageAddsNoPurge(records: seq<app__emailItem_MessageRecord>, record: app__emailItem_MessageRecord)
  requires !record.pending.PurgeMessage?
  ensures forall r :: r in app__email_putMessage(records, record) && r.pending.PurgeMessage? ==> r in records
{
  var keep := (old_: app__emailItem_MessageRecord) => (old_.identity.ref != record.identity.ref);
  assert app__email_putMessage(records, record) == ProofLib.Filter(keep, records) + [record];
  forall r | r in app__email_putMessage(records, record) && r.pending.PurgeMessage?
    ensures r in records
  {
    ProofLib.FilterMember(keep, records, r);
  }
}

lemma ChangedSelectionAddsNoPurge(m: app__email_Mailbox, target: app__email_MessageTarget, change: app__emailItem_MessageChange)
  requires !change.PurgeMessage?
  ensures forall r :: r in app__email_changeSelectedMessage(m, target, change, app__email_MailActor.MailUser).messages && r.pending.PurgeMessage? ==>
    exists o :: o in m.messages && o.identity == r.identity && o.pending.PurgeMessage?
{
  var record := app__emailItem_changeMessage(app__email_messageRecord(m, target.ref), change, app__emailItem_MessageActor.MessageUser);
  PutMessageAddsNoPurge(m.messages, record);
  assert app__email_changeSelectedMessage(m, target, change, app__email_MailActor.MailUser).messages == app__email_putMessage(m.messages, record);
  forall r | r in app__email_putMessage(m.messages, record) && r.pending.PurgeMessage?
    ensures exists o :: o in m.messages && o.identity == r.identity && o.pending.PurgeMessage?
  {
    assert r in m.messages;
  }
}

lemma UndoneTrashAddsNoPurge(m: app__email_Mailbox, target: app__email_MessageTarget)
  ensures forall r :: r in app__email_undoMessageTrash(m, target, app__email_MailActor.MailUser).messages && r.pending.PurgeMessage? ==>
    exists o :: o in m.messages && o.identity == r.identity && o.pending.PurgeMessage?
{
  var record := app__emailItem_undoTrash(app__email_messageRecord(m, target.ref), target.revision, app__emailItem_MessageActor.MessageUser);
  PutMessageAddsNoPurge(m.messages, record);
  assert app__email_undoMessageTrash(m, target, app__email_MailActor.MailUser).messages == app__email_putMessage(m.messages, record);
  forall r | r in app__email_putMessage(m.messages, record) && r.pending.PurgeMessage?
    ensures exists o :: o in m.messages && o.identity == r.identity && o.pending.PurgeMessage?
  {
    assert r in m.messages;
  }
}

lemma GraceAssistKeepsSendingHers(source: app__mailboxes_MailSource, assist: app__email_MailAssist)
  ensures keepsSendingHers(source, assist)
{
  var m := source.mailbox;
  match assist {
    case AssistSearch(q) => {
      var v := app__email_assistedView(app__email_ReadKind.Search, m);
      assert v.outbox == m.outbox && v.issuedSends == m.issuedSends && v.messages == m.messages;
      assert v.approvedRevision == m.approvedRevision && v.sendStatus == m.sendStatus;
      assert v.link == m.link || v.link == app__email_noLink;
    }
    case AssistOpen(r) => {}
    case AssistList => {}
    case AssistNewEmail(rc, sb, b) => {}
    case AssistAddress(rc) => {}
    case AssistFill(b) => {}
    case AssistForward(c) => {}
    case AssistSaveDraft(d) => {}
    case AssistTrash(t) => {
      ChangedSelectionAddsNoPurge(m, t, app__emailItem_MessageChange.TrashMessage);
    }
    case AssistRestore(t) => {
      ChangedSelectionAddsNoPurge(m, t, app__emailItem_MessageChange.RestoreMessage);
    }
    case AssistUndoTrash(t) => {
      UndoneTrashAddsNoPurge(m, t);
    }
    case AssistMarkUnread(t) => {
      ChangedSelectionAddsNoPurge(m, t, app__emailItem_MessageChange.UnreadMessage);
    }
  }
}
