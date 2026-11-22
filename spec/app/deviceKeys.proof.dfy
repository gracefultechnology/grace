lemma lawAnsweringHerOnlyQuestionLetsTheTaskGoOn_ensures(r: app__websiteRequests_WebsiteRequests, id: int, choice: app__websiteRequests_Choice, answeredBy: app__websiteRequests_WebsiteActor, workspaceAdmits: bool)
  ensures (lawAnsweringHerOnlyQuestionLetsTheTaskGoOn(r, id, choice, answeredBy, workspaceAdmits) == true)
{
  app__websiteRequests_lawAnsweringTheOnlyMessageReleasesThePage_ensures(r, id, choice, answeredBy);
}
