import { Text } from '@react-email/components'
import * as React from 'react'
import { TrackzanLayout } from './components/TrackzanLayout'

export function SessionReminderEmail({
  athleteName,
  sessionTitle,
  whenLabel,
  location,
  dashboardUrl,
  siteUrl,
}: {
  athleteName: string
  sessionTitle: string
  whenLabel: string
  location?: string | null
  dashboardUrl: string
  siteUrl: string
}) {
  return (
    <TrackzanLayout siteUrl={siteUrl} previewText={`Reminder: ${sessionTitle}`}>
      <Text style={{ color: '#d4d4d4', fontSize: '15px', lineHeight: 1.55, margin: '0 0 12px' }}>
        Hi {athleteName},
      </Text>
      <Text style={{ color: '#e5e5e5', fontSize: '16px', lineHeight: 1.5, margin: '0 0 8px' }}>
        Reminder: you are booked for <strong>{sessionTitle}</strong>.
      </Text>
      <Text style={{ color: '#a3a3a3', fontSize: '14px', margin: '0 0 6px' }}>When: {whenLabel}</Text>
      {location ? (
        <Text style={{ color: '#a3a3a3', fontSize: '14px', margin: '0 0 20px' }}>Where: {location}</Text>
      ) : (
        <Text style={{ margin: '0 0 20px' }} />
      )}
      <Text style={{ color: '#737373', fontSize: '12px', lineHeight: 1.5, margin: 0, wordBreak: 'break-all' }}>
        Dashboard: {dashboardUrl}
      </Text>
    </TrackzanLayout>
  )
}

export default SessionReminderEmail
