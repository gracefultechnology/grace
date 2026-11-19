lemma SourceRowsFilter(registry: app__accounts_Accounts, source: MailSource, folder: app__emailItem_Folder)
  ensures sourceRows(registry, source, folder) == if ((showsMail(registry, source.account) && (source.mailbox.folder == folder)) && filtered(registry, source.account, folder)) then
    (var s_map := ProofLib.Filter((r: app__emailItem_MessageRecord) => (r.folder == folder), app__email_listedMessages(source.mailbox)); seq(|s_map|, i_map requires 0 <= i_map < |s_map| => var r := s_map[i_map]; Row(source.account, r)))
  else
    []
{
}

lemma ContextRowsFilter(registry: app__accounts_Accounts, source: MailSource)
  ensures contextRows(registry, source) == if showsMail(registry, source.account) then
    (var s_map := ProofLib.Filter((r: app__emailItem_MessageRecord) => seen(r), (ProofLib.Filter((r: app__emailItem_MessageRecord) => r.folder.InboxFolder?, source.mailbox.messages) + openRecords(source.mailbox))); seq(|s_map|, i_map requires 0 <= i_map < |s_map| => var r := s_map[i_map]; Row(source.account, r)))
  else
    []
{
}

lemma MailAccountsFilter(registry: app__accounts_Accounts)
  ensures app__accounts_mailAccounts(registry) == ProofLib.Filter((x: app__accounts_Account) => x.use.mail, registry.accounts)
{
}

lemma FromChoicesFilter(registry: app__accounts_Accounts, sources: seq<MailSource>)
  ensures fromChoices(registry, sources) == ProofLib.Filter((x: app__accounts_Account) => sendsFrom(sourceOf(sources, x.id).mailbox), app__accounts_mailAccounts(registry))
{
}

lemma OpenSourceFilter(registry: app__accounts_Accounts, sources: seq<MailSource>)
  ensures shown(registry, sources) == ProofLib.Filter((s: MailSource) => showsMail(registry, s.account), sources)
  ensures openSource(registry, sources) == (if ((0 <= 0) && (0 < |ProofLib.Filter((s: MailSource) => isOpen(s.mailbox), shown(registry, sources))|)) then ProofLib.Filter((s: MailSource) => isOpen(s.mailbox), shown(registry, sources))[0] else noSource).account
{
}

lemma RowOfSource(registry: app__accounts_Accounts, source: MailSource, folder: app__emailItem_Folder, r: Row)
  requires r in sourceRows(registry, source, folder)
  ensures r.account == source.account && showsMail(registry, source.account) && r.record.folder == folder
  ensures filtered(registry, source.account, folder)
{
  SourceRowsFilter(registry, source, folder);
  var rows := sourceRows(registry, source, folder);
  var k :| 0 <= k < |rows| && rows[k] == r;
  assert showsMail(registry, source.account) && source.mailbox.folder == folder && filtered(registry, source.account, folder);
  var s_map := ProofLib.Filter((r: app__emailItem_MessageRecord) => (r.folder == folder), app__email_listedMessages(source.mailbox));
  assert r == Row(source.account, s_map[k]);
  ProofLib.FilterMember((r: app__emailItem_MessageRecord) => (r.folder == folder), app__email_listedMessages(source.mailbox), s_map[k]);
}

lemma RowOfFolder(registry: app__accounts_Accounts, sources: seq<MailSource>, folder: app__emailItem_Folder, r: Row)
  requires r in folderRows(registry, sources, folder)
  ensures showsMail(registry, r.account) && r.record.folder == folder && filtered(registry, r.account, folder)
{
  ProofLib.FoldLeftConcatMember((rows: seq<Row>, s: MailSource) => (rows + sourceRows(registry, s, folder)), (s: MailSource) => sourceRows(registry, s, folder), [], sources, r);
  var i :| 0 <= i < |sources| && r in sourceRows(registry, sources[i], folder);
  RowOfSource(registry, sources[i], folder, r);
}

lemma lawFolderRowsComeFromShownAccounts_ensures(registry: app__accounts_Accounts, sources: seq<MailSource>, folder: app__emailItem_Folder)
  ensures (lawFolderRowsComeFromShownAccounts(registry, sources, folder) == true)
{
  forall r | r in folderRows(registry, sources, folder) ensures showsMail(registry, r.account) && r.record.folder == folder {
    RowOfFolder(registry, sources, folder, r);
  }
}

lemma lawOneInboxShowsOnlyThatAccount_ensures(registry: app__accounts_Accounts, sources: seq<MailSource>)
  ensures (lawOneInboxShowsOnlyThatAccount(registry, sources) == true)
{
  forall r | r in folderRows(registry, sources, app__emailItem_Folder.InboxFolder) ensures registry.inboxFilter != 0 ==> r.account == registry.inboxFilter {
    RowOfFolder(registry, sources, app__emailItem_Folder.InboxFolder, r);
  }
}

lemma lawAllInboxesKeepsEachAccountsRows_ensures(registry: app__accounts_Accounts, sources: seq<MailSource>, at: int, record: app__emailItem_MessageRecord)
  ensures (lawAllInboxesKeepsEachAccountsRows(registry, sources, at, record) == true)
{
  if 0 <= at < |sources| {
    var source := sources[at];
    var folder := app__emailItem_Folder.InboxFolder;
    if registry.inboxFilter == 0 && showsMail(registry, source.account) && source.mailbox.folder.InboxFolder? && record in app__email_listedMessages(source.mailbox) && record.folder.InboxFolder? {
      SourceRowsFilter(registry, source, folder);
      var s_map := ProofLib.Filter((r: app__emailItem_MessageRecord) => (r.folder == folder), app__email_listedMessages(source.mailbox));
      ProofLib.FilterMember((r: app__emailItem_MessageRecord) => (r.folder == folder), app__email_listedMessages(source.mailbox), record);
      var k :| 0 <= k < |s_map| && s_map[k] == record;
      assert sourceRows(registry, source, folder)[k] == Row(source.account, record);
      ProofLib.FoldLeftConcatMember((rows: seq<Row>, s: MailSource) => (rows + sourceRows(registry, s, folder)), (s: MailSource) => sourceRows(registry, s, folder), [], sources, Row(source.account, record));
    }
  }
}

lemma BannerOfSources(registry: app__accounts_Accounts, sources: seq<MailSource>, b: MailBanner)
  requires b in accountBanners(registry, sources)
  ensures !b.kind.OfflineBanner? && showsMail(registry, b.account)
  ensures b.kind.SignInBanner? ==> exists s :: s in sources && s.account == b.account && needsSignIn(s.mailbox)
{
  ProofLib.FoldLeftConcatMember((shown: seq<MailBanner>, s: MailSource) => (shown + sourceBanners(registry, sources, s)), (s: MailSource) => sourceBanners(registry, sources, s), [], sources, b);
  var i :| 0 <= i < |sources| && b in sourceBanners(registry, sources, sources[i]);
  assert sources[i] in sources;
}

lemma BannerShown(registry: app__accounts_Accounts, sources: seq<MailSource>, online: bool, b: MailBanner)
  requires b in banners(registry, sources, online)
  ensures b.kind.OfflineBanner? ==> b.account == 0
  ensures !b.kind.OfflineBanner? ==> showsMail(registry, b.account)
  ensures b.kind.SignInBanner? ==> exists s :: s in sources && s.account == b.account && needsSignIn(s.mailbox)
{
  if b !in accountBanners(registry, sources) {
    assert b == offlineBanner;
  } else {
    BannerOfSources(registry, sources, b);
  }
}

lemma lawOfflineIsNotABrokenAccount_ensures(registry: app__accounts_Accounts, sources: seq<MailSource>)
  ensures (lawOfflineIsNotABrokenAccount(registry, sources) == true)
{
  assert banners(registry, sources, true) == accountBanners(registry, sources);
  forall b | b in banners(registry, sources, true) ensures !b.kind.OfflineBanner? {
    BannerOfSources(registry, sources, b);
  }
}

lemma lawSignInBannerNamesABrokenAccount_ensures(registry: app__accounts_Accounts, sources: seq<MailSource>, online: bool)
  ensures (lawSignInBannerNamesABrokenAccount(registry, sources, online) == true)
{
  forall b | b in banners(registry, sources, online) && b.kind.SignInBanner?
    ensures showsMail(registry, b.account) && (exists s :: s in sources && ((s.account == b.account) && needsSignIn(s.mailbox)))
  {
    BannerShown(registry, sources, online, b);
  }
}

lemma ContextRow(registry: app__accounts_Accounts, sources: seq<MailSource>, r: Row)
  requires r in mailContext(registry, sources)
  ensures showsMail(registry, r.account) && seen(r.record)
{
  ProofLib.FoldLeftConcatMember((rows: seq<Row>, s: MailSource) => (rows + contextRows(registry, s)), (s: MailSource) => contextRows(registry, s), [], sources, r);
  var i :| 0 <= i < |sources| && r in contextRows(registry, sources[i]);
  var source := sources[i];
  ContextRowsFilter(registry, source);
  var rows := contextRows(registry, source);
  var j :| 0 <= j < |rows| && rows[j] == r;
  assert showsMail(registry, source.account);
  var visible := ProofLib.Filter((r: app__emailItem_MessageRecord) => r.folder.InboxFolder?, source.mailbox.messages) + openRecords(source.mailbox);
  var s_map := ProofLib.Filter((r: app__emailItem_MessageRecord) => seen(r), visible);
  var k := j;
  assert r == Row(source.account, s_map[k]);
  ProofLib.FilterMember((r: app__emailItem_MessageRecord) => seen(r), visible, s_map[k]);
}

lemma lawGraceSeesNoHiddenMail_ensures(registry: app__accounts_Accounts, sources: seq<MailSource>)
  ensures (lawGraceSeesNoHiddenMail(registry, sources) == true)
{
  forall r | r in mailContext(registry, sources) ensures showsMail(registry, r.account) && seen(r.record) {
    ContextRow(registry, sources, r);
  }
}

lemma MailAccountShown(registry: app__accounts_Accounts, x: app__accounts_Account)
  requires x in app__accounts_mailAccounts(registry)
  ensures showsMail(registry, x.id)
{
  MailAccountsFilter(registry);
  ProofLib.FilterMember((x: app__accounts_Account) => x.use.mail, registry.accounts, x);
}

lemma OutboxRowShown(registry: app__accounts_Accounts, sources: seq<MailSource>, r: OutboxRow)
  requires r in outboxRows(registry, sources)
  ensures showsMail(registry, r.account)
{
  ProofLib.FoldLeftConcatMember((rows: seq<OutboxRow>, s: MailSource) => (rows + sourceOutbox(registry, s)), (s: MailSource) => sourceOutbox(registry, s), [], sources, r);
  var i :| 0 <= i < |sources| && r in sourceOutbox(registry, sources[i]);
}

lemma OpenSourceShown(registry: app__accounts_Accounts, sources: seq<MailSource>)
  ensures openSource(registry, sources) == 0 || showsMail(registry, openSource(registry, sources))
{
  OpenSourceFilter(registry, sources);
  var visible := shown(registry, sources);
  var opens := ProofLib.Filter((s: MailSource) => isOpen(s.mailbox), visible);
  if 0 < |opens| {
    ProofLib.FilterMember((s: MailSource) => isOpen(s.mailbox), visible, opens[0]);
    ProofLib.FilterMember((s: MailSource) => showsMail(registry, s.account), sources, opens[0]);
  }
}

lemma lawHiddenAccountShowsNothing_ensures(registry: app__accounts_Accounts, sources: seq<MailSource>, folder: app__emailItem_Folder, online: bool, account: int)
  ensures (lawHiddenAccountShowsNothing(registry, sources, folder, online, account) == true)
{
  if account != 0 && !showsMail(registry, account) {
    forall r | r in folderRows(registry, sources, folder) ensures r.account != account {
      RowOfFolder(registry, sources, folder, r);
    }
    forall r | r in outboxRows(registry, sources) ensures r.account != account {
      OutboxRowShown(registry, sources, r);
    }
    forall r | r in accountRows(registry, sources) ensures r.id != account {
      assert allInboxes(registry);
      var s_map := app__accounts_mailAccounts(registry);
      var rows := accountRows(registry, sources);
      var k :| 0 <= k < |rows| && rows[k] == r;
      assert r.id == s_map[k].id;
      MailAccountShown(registry, s_map[k]);
    }
    forall b | b in banners(registry, sources, online) ensures b.account != account {
      BannerShown(registry, sources, online, b);
    }
    forall x | x in fromChoices(registry, sources) ensures x.id != account {
      FromChoicesFilter(registry, sources);
      ProofLib.FilterMember((x: app__accounts_Account) => sendsFrom(sourceOf(sources, x.id).mailbox), app__accounts_mailAccounts(registry), x);
      MailAccountShown(registry, x);
    }
    OpenSourceShown(registry, sources);
    forall r | r in mailContext(registry, sources) ensures r.account != account {
      ContextRow(registry, sources, r);
    }
  }
}

lemma AttachedKeepsDraft(g: (app__email_Mailbox, app__files_SavedFile) -> app__email_Mailbox, m: app__email_Mailbox, files: seq<app__files_SavedFile>)
  requires forall a, f :: g(a, f) == app__email_attachAsset(a, a.owner, f, a.revision, true, app__email_MailActor.MailHost)
  requires m.approvedRevision == -1 && m.sendStatus.Composing?
  ensures Std.Collections.Seq.FoldLeft(g, m, files).draftAttachments == m.draftAttachments + files
  ensures Std.Collections.Seq.FoldLeft(g, m, files).draft == m.draft
  ensures Std.Collections.Seq.FoldLeft(g, m, files).replyTo == m.replyTo
  ensures Std.Collections.Seq.FoldLeft(g, m, files).composeVisible == m.composeVisible
  ensures Std.Collections.Seq.FoldLeft(g, m, files).draftId == m.draftId
  ensures Std.Collections.Seq.FoldLeft(g, m, files).approvedRevision == -1
  ensures Std.Collections.Seq.FoldLeft(g, m, files).sendStatus.Composing?
  decreases |files|
{
  if |files| > 0 {
    AttachedKeepsDraft(g, g(m, files[0]), files[1..]);
    assert m.draftAttachments + [files[0]] + files[1..] == m.draftAttachments + files;
  }
}

lemma MovedDraftOpened(drafting: app__email_Mailbox, chosen: app__email_Mailbox)
  requires canMoveDraft(drafting, chosen)
  ensures moveDraft(drafting, chosen).MovedDraft?
  ensures moveDraft(drafting, chosen).opened_.draft == drafting.draft
  ensures moveDraft(drafting, chosen).opened_.draftAttachments == drafting.draftAttachments
  ensures moveDraft(drafting, chosen).opened_.replyTo == ""
  ensures moveDraft(drafting, chosen).opened_.composeVisible
  ensures moveDraft(drafting, chosen).opened_.draftId == ""
  ensures moveDraft(drafting, chosen).opened_.approvedRevision == -1
  ensures moveDraft(drafting, chosen).opened_.sendStatus.Composing?
  ensures moveDraft(drafting, chosen).emptied == app__email_discardDraft(drafting, true, app__email_MailActor.MailUser)
{
  var written := app__email_editDraft(app__email_startDraft(chosen, false, app__email_MailActor.MailUser), drafting.draft, app__email_MailActor.MailUser);
  AttachedKeepsDraft((m: app__email_Mailbox, f: app__files_SavedFile) => app__email_attachAsset(m, m.owner, f, m.revision, true, app__email_MailActor.MailHost), written, drafting.draftAttachments);
}

lemma lawMovedDraftKeepsContent_ensures(drafting: app__email_Mailbox, chosen: app__email_Mailbox)
  ensures (lawMovedDraftKeepsContent(drafting, chosen) == true)
{
  if canMoveDraft(drafting, chosen) {
    MovedDraftOpened(drafting, chosen);
  }
}

lemma lawMovedDraftIsUnapproved_ensures(drafting: app__email_Mailbox, chosen: app__email_Mailbox)
  ensures (lawMovedDraftIsUnapproved(drafting, chosen) == true)
{
  if canMoveDraft(drafting, chosen) {
    MovedDraftOpened(drafting, chosen);
  }
}

lemma FilterTwice<T>(p: T -> bool, xs: seq<T>)
  ensures ProofLib.Filter(p, ProofLib.Filter(p, xs)) == ProofLib.Filter(p, xs)
  decreases |xs|
{
  if |xs| == 0 {
    ProofLib.FilterNil(p, xs);
    ProofLib.FilterNil(p, ProofLib.Filter(p, xs));
  } else {
    ProofLib.FilterCons(p, xs);
    FilterTwice(p, xs[1..]);
    var rest := ProofLib.Filter(p, xs[1..]);
    if p(xs[0]) {
      ProofLib.FilterCons(p, [xs[0]] + rest);
      assert ([xs[0]] + rest)[1..] == rest;
    } else {
      assert ProofLib.Filter(p, xs) == rest;
    }
  }
}

lemma ShownTwice(registry: app__accounts_Accounts, sources: seq<MailSource>)
  ensures shown(registry, shown(registry, sources)) == shown(registry, sources)
{
  OpenSourceFilter(registry, sources);
  OpenSourceFilter(registry, shown(registry, sources));
  FilterTwice((s: MailSource) => showsMail(registry, s.account), sources);
}

lemma NoMailAccounts(registry: app__accounts_Accounts)
  ensures showsConnect(registry) <==> forall x :: x in registry.accounts ==> !x.use.mail
{
  MailAccountsFilter(registry);
  ProofLib.FilterNone((x: app__accounts_Account) => x.use.mail, registry.accounts);
  if forall i :: 0 <= i < |registry.accounts| ==> !registry.accounts[i].use.mail {
    forall x | x in registry.accounts ensures !x.use.mail {
      var i :| 0 <= i < |registry.accounts| && registry.accounts[i] == x;
    }
  }
}

lemma lawConnectShowsExactlyWithoutEmail_ensures(registry: app__accounts_Accounts)
  ensures (lawConnectShowsExactlyWithoutEmail(registry) == true)
{
  NoMailAccounts(registry);
  var choices := mailChoices(registry);
  if showsConnect(registry) {
    assert choices == [MailChoice.ConnectChoice, MailChoice.AskGraceChoice];
    forall c | c in choices ensures !c.WriteChoice? && !c.FolderChoice? {
      assert c == choices[0] || c == choices[1];
    }
  } else {
    assert choices[0] in choices && choices[0].WriteChoice?;
  }
}

lemma lawLastEmailOffShowsConnect_ensures(registry: app__accounts_Accounts, account: int, use: app__accounts_Use)
  ensures (lawLastEmailOffShowsConnect(registry, account, use) == true)
{
  if app__accounts_canSetUse(registry, account, use, app__accounts_AccountActor.AccountPerson) && !use.mail && (forall x :: x in app__accounts_mailAccounts(registry) ==> x.id == account) {
    var after := app__accounts_setUse(registry, account, use, app__accounts_AccountActor.AccountPerson);
    forall x | x in after.accounts ensures !x.use.mail {
      var i :| 0 <= i < |after.accounts| && after.accounts[i] == x;
      var y := registry.accounts[i];
      if y.id != account && y.use.mail {
        MailAccountsFilter(registry);
        ProofLib.FilterMember((x: app__accounts_Account) => x.use.mail, registry.accounts, y);
      }
    }
    NoMailAccounts(after);
  }
}

lemma lawHomeCountsOnlyShownMail_ensures(registry: app__accounts_Accounts, sources: seq<MailSource>, online: bool)
  ensures (lawHomeCountsOnlyShownMail(registry, sources, online) == true)
{
  ShownTwice(registry, sources);
  var inbox := ProofLib.Filter((r: Row) => r.record.folder.InboxFolder?, mailContext(registry, sources));
  forall r | r in homeRows(registry, sources) ensures showsMail(registry, r.account) && r.record.folder.InboxFolder? {
    ProofLib.FilterMember((r: Row) => r.record.unread, inbox, r);
    ProofLib.FilterMember((r: Row) => r.record.folder.InboxFolder?, mailContext(registry, sources), r);
    ContextRow(registry, sources, r);
  }
}

lemma lawDraftsCountOnlyShownMail_ensures(registry: app__accounts_Accounts, sources: seq<MailSource>)
  ensures (lawDraftsCountOnlyShownMail(registry, sources) == true)
{
  ShownTwice(registry, sources);
}
