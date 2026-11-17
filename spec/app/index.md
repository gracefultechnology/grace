# Grace MVP product contract

The current request includes email, calendar, Files, browser and bill payment launched from calendar. Older single-site or pitch-only exclusions do not limit this rebuild. The replacement `prototype/Grace Prototype.html` provides the design and application flows for Home, the rail, Email, Calendar, Files, settings, browser and compact/expanded Grace. Its actual application flows supersede the earlier bill-pay-only prototype; mock provider and storage success are replaced with explicit integration outcomes.

The visual direction is the prototype's Figtree typography, soft gradient frame, glass surfaces, lilac conversation and familiar browser. Keep the calendar, email and internet previews, persistent labeled Ask Grace entry, compact bottom assistance, expanded chat, website keyboard state and caption strip. No provider page is restyled. Layout dimensions are responsive to measured usable space and native keyboard insets; prototype canvas dimensions are references, not fixed runtime assumptions. Exact tokens, visual comparison, accessible labels and hardware readability are implementation acceptance criteria.

- [Device readiness, Home and native settings](./shell.md)
- [Set-up of a new tablet, resumable across restarts](./setup.md)
- [Wi-Fi selection, private sign-in and connection recovery](./network.md)
- [Browser tabs, navigation and current-page state](./browser.md)
- [Browser controls and current host observations](./browserControls.md)
- [The website drawn under Grace and touch routing](./surface.md)
- [Website messages, downloads, file choices, site permissions and sign-ins](./websiteRequests.md)
- [Android Back and launcher Home keys](./deviceKeys.md)
- [Conversation, voice, typed input and reading continuity](./conversation.md)
- [Hey Grace, sleep wake and unanswered listening](./wake.md)
- [One assistance task, compact and expanded presentation](./assistant.md)
- [Shared conversation controls and service-result routing](./interaction.md)
- [Approved personal memory and deletion](./memory.md)
- [Saved details: the list she approves, sees and deletes](./savedDetails.md)
- [Voice output, pace and readable text preferences](./preferences.md)
- [Turn requests, consent used once and who may act](./request.md)
- [Email accounts, provider sign-in, uses and removal](./accounts.md)
- [Email connection, reading, attachments and reviewed sending](./email.md)
- [Message folders, read status, Trash and restoration](./emailItem.md)
- [Calendar occurrences, recurrence and reminders](./calendar.md)
- [Week and month views, current occurrences and recurring deletion](./calendarView.md)
- [The calendar question Grace is waiting on and her yes](./proposal.md)
- [All inboxes, Outbox, account banners and the From address](./mailboxes.md)
- [Calendars together, tags, the connect banner and an appointment from an email](./calendars.md)
- [What Grace may do with email and the calendar, each action routed to its guarded event](./agentActions.md)
- [Saved photos, documents and Email sharing](./files.md)
- [Generic evidence-grounded website operations](./execution.md)
- [Bill discovery, choices and verified preparation](./billpay.md)
- [Verified preparation to the current payment review](./preparationReview.md)
- [Payment authorization, durable attempts and provider outcomes](./payment.md)
- [One canonical bill across Email, Calendar and browser entry points](./handoffs.md)
- [Composed navigation, interruption and execution](./workspace.md)
- [Actuator checks for emitted browser and payment commands](./actuation.md)
- [Current saved-value authority for queued website fills](./memoryActuation.md)

Personal memory, task state and provider records have distinct lifecycles. Deleting a calendar item or remembered fact never cancels a payment or removes unresolved evidence. New sessions and different surfaces cannot create a new identity for the same provider bill. Scheduled and accepted are not settlement. Unsupported sites, missing evidence, unavailable sign-in challenges and privacy failures stop with an explanation and a usable manual path.

The application in `apps/app` is a Capacitor Android APK, in a launcher (Home) and a standalone flavor, built on the shared Android host, browser surface and AOSP staging of the pinned `vendor/eliza`. The formal checks establish these models and their generated contracts; storage durability, provider integrations, speech capture, visual fidelity and senior usability still need the acceptance exercises on the device.
