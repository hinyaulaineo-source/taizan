const SUBJECTS: Record<string, string> = {
  signup: 'Confirm your TrackZAN email',
  recovery: 'Reset your TrackZAN password',
  invite: 'You are invited to TrackZAN',
  magiclink: 'Your TrackZAN sign-in link',
  email_change: 'Confirm your email address change',
  email_change_new: 'Confirm your new email on TrackZAN',
  reauthentication: 'Confirm it is you — TrackZAN',
}

export function authEmailSubject(email_action_type: string): string {
  return SUBJECTS[email_action_type] ?? 'TrackZAN notification'
}
