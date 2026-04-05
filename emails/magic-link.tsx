import { Button, Section, Text } from '@react-email/components'
import * as React from 'react'
import { TrackzanLayout } from './components/TrackzanLayout'

export function MagicLinkEmail({
  confirmationUrl,
  email,
  siteUrl,
  token,
}: {
  confirmationUrl: string
  email: string
  siteUrl: string
  token?: string
}) {
  return (
    <TrackzanLayout siteUrl={siteUrl} previewText="Sign in to TrackZAN">
      <Text style={{ color: '#d4d4d4', fontSize: '15px', lineHeight: 1.55, margin: '0 0 16px' }}>
        Sign-in link for <strong>{email}</strong>.
      </Text>
      <Text style={{ color: '#a3a3a3', fontSize: '14px', lineHeight: 1.55, margin: '0 0 24px' }}>
        Click below to log in. The link expires soon.
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
          Sign in
        </Button>
      </Section>
      {token ? (
        <Text style={{ color: '#737373', fontSize: '13px', margin: '0 0 20px' }}>
          Code: <strong style={{ color: '#e5e5e5' }}>{token}</strong>
        </Text>
      ) : null}
      <Text style={{ color: '#737373', fontSize: '12px', lineHeight: 1.5, margin: 0, wordBreak: 'break-all' }}>
        {confirmationUrl}
      </Text>
    </TrackzanLayout>
  )
}

export default MagicLinkEmail
