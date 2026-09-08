# UnitedBML V12.10.3 AP Single-Send Protection

## Problem
Large AP emails can take several seconds because UnitedBML may need to:
1. save/upload bills,
2. generate the Approved Expense Note,
3. download Procurement evidence,
4. convert attachments,
5. invoke the email service,
6. wait for the provider response.

Users could click **Send AP Email + Attachments** more than once while waiting,
causing duplicate emails.

## Protection added

### Immediate UI mutex
On the first click:
- Send button disables immediately
- Save Bills and Close buttons temporarily disable
- Send changes to `Sending…`
- visible progress panel is shown
- subsequent clicks are ignored

### Persistent AP batch guard
Before the slow email work begins, the batch stores:
- `emailSendingAt`
- `emailSendingBy`
- `emailSendAttemptId`

The guard is persisted before sending.

If the batch is already:
- `Sent to AP`, or
- has `sentAt`

another send is rejected.

An active send lock under 2 minutes is also rejected. Stale locks older than
2 minutes can be retried after a browser/network failure.

### Failure handling
If sending genuinely fails:
- the send lock is cleared
- buttons are enabled again
- user may retry

If sending succeeds:
- batch is marked `Sent to AP`
- `sentAt` and provider message ID are stored
- the modal closes
- future send attempts for that batch are blocked

No SQL migration is required because AP batch `data` already stores these
additional fields.
