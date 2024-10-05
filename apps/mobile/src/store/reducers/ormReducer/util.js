export function showMessagesBadge (session) {
  // it is not strictly correct to do this every time you receive a message,
  // because the message you're receiving could be in a thread that was already
  // unseen. but since the UI doesn't show the count, just a badge, it just
  // needs to know whether there are more than 0 unseen threads, and this takes
  // care of that.
  //
  // we have to check that the current user exists, because this code could be
  // run while they are logged out.
  const me = session.Me.first()
  if (me) me.increment('unseenThreadCount')
}
