import { Button, Section, Text } from '@react-email/components'
import * as React from 'react'
import { TrackzanLayout } from './components/TrackzanLayout'

export function InviteUserEmail({
  confirmationUrl,
  email,
  siteUrl,
  siteName = 'TrackZAN',
}: {
  confirmationUrl: string
  email: string
  siteUrl: string
  siteName?: string
}) {
  return (
    <TrackzanLayout
      siteUrl={siteUrl}
      previewText={`Join ${siteName} — accept your invite`}
    >
      <Text style={{ color: '#d4d4d4', fontSize: '15px', lineHeight: 1.55, margin: '0 0 16px' }}>
        You have been invited to create an account on <strong>{siteName}</strong> ({email}
        ).
      </Text>
      <Text style={{ color: '#a3a3a3', fontSize: '14px', lineHeight: 1.55, margin: '0 0 24px' }}>
        Use the button below to accept the invite and finish setting up your account.
      </Text>
      <Section style={{ marginBottom: '24px' }}>
        <Button
          href={confirmationUrl}
          style={{
            backgroundColor: '#fafafa',
            color: '#0a0a0a',
            padding: '12px 24px',
            borderRadius: '8px',
            fontWeight: 700,
            fontSize: '14px',
            textDecoration: 'none',
            display: 'inline-block',
            fontFamily: 'ui-monospace, monospace',
          }}
        >
          Accept invitation
        </Button>
      </Section>
      <Text style={{ color: '#737373', fontSize: '12px', lineHeight: 1.5, margin: 0 }}>
        If the button does not work, copy and paste this link into your browser:
        <br />
        <span style={{ color: '#a3a3a3', wordBreak: 'break-all' }}>{confirmationUrl}</span>
      </Text>
    </TrackzanLayout>
  )
}

export default InviteUserEmail
