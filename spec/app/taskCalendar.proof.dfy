lemma lawRecordCarriesTheBookedTime_ensures(booked: app__commitment_Commitment, calendarId: string, timezone: string)
  ensures (lawRecordCarriesTheBookedTime(booked, calendarId, timezone) == true)
{
  if recordAllowed(booked) {
    assert booked.proposal.BookTerms?;
    assert bookedSlot(booked) == booked.proposal.book.slot;
    assert bookedService(booked) == booked.proposal.book.service;
    assert bookedSlot(booked).minutes * minuteLength > 0;
  }
}
