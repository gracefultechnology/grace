lemma skip_ensures(s: Setup, st: SetupStage)
  ensures (inv(s) ==> canSkip(s, st) ==> alwaysTheCurrentStepIsNotAlreadyTrue(skip(s, st)))
  ensures (inv(s) ==> canSkip(s, st) ==> alwaysTheCountFitsTheStepsShown(skip(s, st)))
  ensures (inv(s) ==> canSkip(s, st) ==> alwaysPutOffAccountIsStillMissing(skip(s, st)))
  ensures (inv(s) ==> canSkip(s, st) ==> alwaysTheEndIsSavedOnlyWhileGraceCanThink(skip(s, st)))
  ensures (inv(s) ==> canSkip(s, st) ==> alwaysEarlierStepsAreSettled(skip(s, st)))
  ensures (inv(s) ==> canSkip(s, st) ==> alwaysAwayMeansSetUpWentAway(skip(s, st)))
  ensures (inv(s) ==> canSkip(s, st) ==> alwaysEndingIsAtTheHandOver(skip(s, st)))
  ensures (inv(s) ==> canSkip(s, st) ==> alwaysTheHandOverIsNotAQuestion(skip(s, st)))
  ensures (inv(s) ==> canSkip(s, st) ==> alwaysEndTokensCount(skip(s, st)))
  ensures (inv(s) ==> canSkip(s, st) ==> stepRestartKeepsTheStep(s, "skip", skip(s, st)))
  ensures (inv(s) ==> canSkip(s, st) ==> stepOnlyItsAnswerASkipOrItsOutcomeAdvances(s, "skip", skip(s, st)))
  ensures (inv(s) ==> canSkip(s, st) ==> stepNeverGoesBack(s, skip(s, st)))
  ensures (inv(s) ==> canSkip(s, st) ==> stepAccountIsPassedOnlyWithAnAccount(s, skip(s, st)))
  ensures (inv(s) ==> canSkip(s, st) ==> stepSetUpEndsOnlyWhileGraceCanThink(s, skip(s, st)))
  ensures (inv(s) ==> canSkip(s, st) ==> stepTalkIsTriedOnlyWhileGraceSpeaks(s, "skip", skip(s, st)))
  ensures (inv(s) ==> canSkip(s, st) ==> stepEachRunEndsOnce(s, skip(s, st), []))
  ensures (inv(s) ==> canSkip(s, st) ==> stepOnlyTheAcknowledgementEnds(s, "skip", skip(s, st)))
{
  if inv(s) && canSkip(s, st) {
    assert st == s.progress.step;
    assert alwaysEarlierStepsAreSettled(s);
    if st.AccountStep? {
      SetupRecordCurrent(s, false, false);
    } else {
      assert !st.HandOverStep?;
      SetupRecordCurrent(s, false, true);
      var onward := s.(progress := SetupProgress(nextStep(st), withOutcome(s.progress, st, false)));
      SetupApplyOneFact(onward, SetupStage.WifiStep);
      var wifi := onward.(progress := passOne(onward.progress, SetupStage.WifiStep, s.facts));
      SetupApplyOneFact(wifi, SetupStage.AccountStep);
      var account := wifi.(progress := passOne(wifi.progress, SetupStage.AccountStep, s.facts));
      SetupApplyOneFact(account, SetupStage.NameStep);
      var named := account.(progress := passOne(account.progress, SetupStage.NameStep, s.facts));
      assert skip(s, st).progress == named.progress;
    }
  }
}

lemma SetupStageOrder(st: SetupStage, stage: SetupStage)
  ensures orderOf(st) == orderOf(stage) ==> st == stage
  ensures !st.HandOverStep? ==> orderOf(nextStep(st)) == orderOf(st) + 1
{
}

lemma SetupSettledAt(s: Setup, stage: SetupStage)
  requires alwaysEarlierStepsAreSettled(s)
  requires stage in allSetupSteps
  ensures if orderOf(stage) < orderOf(s.progress.step) then !outcomeOf(s.progress, stage).Pending?
          else if stage == s.progress.step && stage.AccountStep? then !outcomeOf(s.progress, stage).Done?
          else outcomeOf(s.progress, stage).Pending?
{
}

lemma SetupRecordCurrent(s: Setup, answered: bool, advance: bool)
  requires alwaysEarlierStepsAreSettled(s)
  requires if advance then !s.progress.step.HandOverStep? else s.progress.step.AccountStep? && !answered
  ensures alwaysEarlierStepsAreSettled(s.(progress := SetupProgress(
    if advance then nextStep(s.progress.step) else s.progress.step,
    withOutcome(s.progress, s.progress.step, answered))))
{
  var current := s.progress.step;
  var updated := s.(progress := SetupProgress(if advance then nextStep(current) else current, withOutcome(s.progress, current, answered)));
  forall stage | stage in allSetupSteps
    ensures if orderOf(stage) < orderOf(updated.progress.step) then !outcomeOf(updated.progress, stage).Pending?
            else if stage == updated.progress.step && stage.AccountStep? then !outcomeOf(updated.progress, stage).Done?
            else outcomeOf(updated.progress, stage).Pending?
  {
    SetupSettledAt(s, stage);
    SetupStageOrder(current, stage);
    if stage == current {
      assert outcomeOf(updated.progress, stage) == outcomeFor(answered);
    } else {
      assert outcomeOf(updated.progress, stage) == outcomeOf(s.progress, stage);
    }
  }
}

lemma SetupApplyOneFact(s: Setup, stage: SetupStage)
  requires alwaysEarlierStepsAreSettled(s)
  requires !stage.HandOverStep?
  ensures alwaysEarlierStepsAreSettled(s.(progress := passOne(s.progress, stage, s.facts)))
{
  if passes(stage, s.facts) {
    if stage == s.progress.step {
      SetupRecordCurrent(s, true, true);
    } else if outcomeOf(s.progress, stage).PutOff? {
      assert stage in allSetupSteps;
      SetupSettledAt(s, stage);
      assert orderOf(stage) < orderOf(s.progress.step);
      var updated := s.(progress := passOne(s.progress, stage, s.facts));
      forall other | other in allSetupSteps
        ensures if orderOf(other) < orderOf(updated.progress.step) then !outcomeOf(updated.progress, other).Pending?
                else if other == updated.progress.step && other.AccountStep? then !outcomeOf(updated.progress, other).Done?
                else outcomeOf(updated.progress, other).Pending?
      {
        SetupSettledAt(s, other);
        SetupStageOrder(stage, other);
        if other == stage {
          assert outcomeOf(updated.progress, other).Done?;
        } else {
          assert outcomeOf(updated.progress, other) == outcomeOf(s.progress, other);
        }
      }
    }
  }
}
