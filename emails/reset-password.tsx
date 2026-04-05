import { Button, Section, Text } from '@react-email/components'
import * as React from 'react'
import { TrackzanLayout } from './components/TrackzanLayout'

export function ResetPasswordEmail({
  confirmationUrl,
  email,
  siteUrl,
  token,
}: {
  confirmationUrl: string
  email: string
  siteUrl: string
  /** Optional 6-digit OTP from Supabase when enabled */
  token?: string
}) {
  return (
    <TrackzanLayout siteUrl={siteUrl} previewText="Reset your TrackZAN password">
      <Text style={{ color: '#d4d4d4', fontSize: '15px', lineHeight: 1.55, margin: '0 0 16px' }}>
        We received a request to reset the password for <strong>{email}</strong>.
      </Text>
      <Text style={{ color: '#a3a3a3', fontSize: '14px', lineHeight: 1.55, margin: '0 0 24px' }}>
        Click the button below to choose a new password. This link expires after a short time.
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
          Reset password
        </Button>
      </Section>
      {token ? (
        <Text style={{ color: '#737373', fontSize: '13px', margin: '0 0 20px' }}>
          Or enter this code in the app: <strong style={{ color: '#e5e5e5' }}>{token}</strong>
        </Text>
      ) : null}
      <Text style={{ color: '#737373', fontSize: '12px', lineHeight: 1.5, margin: 0 }}>
        If you did not request this, you can ignore this email.
        <br />
        <span style={{ color: '#a3a3a3', wordBreak: 'break-all' }}>{confirmationUrl}</span>
      </Text>
    </TrackzanLayout>
  )
}

export default ResetPasswordEmail
