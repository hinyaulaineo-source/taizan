import { Button, Section, Text } from '@react-email/components'
import * as React from 'react'
import { TrackzanLayout } from './components/TrackzanLayout'

/** Fallback for email_change, email_change_new, reauthentication, etc. */
export function GenericAuthEmail({
  confirmationUrl,
  email,
  siteUrl,
  title,
  body,
  ctaLabel,
  token,
}: {
  confirmationUrl: string
  email: string
  siteUrl: string
  title: string
  body: string
  ctaLabel: string
  token?: string
}) {
  return (
    <TrackzanLayout siteUrl={siteUrl} previewText={title}>
      <Text style={{ color: '#fafafa', fontSize: '17px', fontWeight: 600, margin: '0 0 12px' }}>{title}</Text>
      <Text style={{ color: '#d4d4d4', fontSize: '15px', lineHeight: 1.55, margin: '0 0 8px' }}>
        {body}
      </Text>
      <Text style={{ color: '#737373', fontSize: '13px', margin: '0 0 20px' }}>{email}</Text>
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
          {ctaLabel}
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

export default GenericAuthEmail
