# UI/UX Standards

## An interface must never report success for work that didn't happen

The forward-sync "Push to Drive" button says "Successfully pushed N folders
and M media assets up to Google Drive" while the handler behind it never
uploads a single byte — it just counts `driveImageUrls.length` and calls
that "pushed." Whoever reads that message has no way to know it's fiction.
If a code path is a stub, a no-op, or does less than its label claims,
either the label changes to say so, or the code gets finished before it
ships a success message. Never both claim more and do less.

## A control with no real distinction is worse than no control

The YouTube sync card had a "Stream ➔ App" / "App ➔ Stream" toggle where
both positions called the exact same function with the exact same
arguments. This isn't a minor cosmetic issue — it actively misleads the
person using it into believing a choice was made and respected. If two UI
states don't produce different behavior, delete the toggle, don't leave it
as decoration.

## Progress must track ground truth, not optimistic local state

The YouTube upload progress bar used to advance based on bytes the browser
had handed to the OS socket (`xhr.upload.onprogress`), which can race far
ahead of what Google has actually received and acknowledged. That produced
the "99% then restart" experience users kept hitting. The fix: only advance
progress on a server-confirmed byte offset (a real 308 Resume Incomplete
response), even though that means the bar sometimes sits still while bytes
are in flight. A slower-looking but honest progress bar beats a fast one
that lies and then jumps backward.

## Error messages are for the person seeing them, not just the log

Prefer messages that say what actually went wrong and, where possible,
what to do about it (this app already does this well in newer code — e.g.
"Your session needs a quick refresh before uploading. Please log out and
log back in, then try again." instead of a raw storage error). Extend that
standard to new work; don't regress to `res.status(500).json({error:
'Failed'})` style messages that give the user nothing to act on.

## Silent failure at a boundary that affects visible state is a UX bug

`makeFilePublicReadable` swallows every error from the make-public call
with just a console warning. If that call fails, the photo or video the
user just uploaded stays private on Drive — its link 403s for everyone —
while the app already told the uploader "upload successful." A failure
that changes what other people can see should never be silent; at minimum
surface it as a retryable warning on that specific item, don't bury it in
a log no user will ever read.
