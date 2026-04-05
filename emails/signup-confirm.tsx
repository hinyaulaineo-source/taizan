import { Button, Section, Text } from '@react-email/components'
import * as React from 'react'
import { TrackzanLayout } from './components/TrackzanLayout'

export function SignupConfirmEmail({
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
    <TrackzanLayout siteUrl={siteUrl} previewText="Confirm your TrackZAN email">
      <Text style={{ color: '#d4d4d4', fontSize: '15px', lineHeight: 1.55, margin: '0 0 16px' }}>
        Thanks for signing up with <strong>{email}</strong>.
      </Text>
      <Text style={{ color: '#a3a3a3', fontSize: '14px', lineHeight: 1.55, margin: '0 0 24px' }}>
        Confirm your email address to finish creating your account.
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
          Confirm email
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

export default SignupConfirmEmail
