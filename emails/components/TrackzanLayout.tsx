import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'

const fontFamily = 'Montserrat, ui-sans-serif, system-ui, sans-serif'

export function TrackzanLayout({
  previewText,
  children,
  siteUrl,
}: {
  previewText: string
  children: React.ReactNode
  siteUrl: string
}) {
  const origin = siteUrl.replace(/\/$/, '')

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body
        style={{
          backgroundColor: '#0a0a0a',
          color: '#e5e5e5',
          fontFamily,
          margin: 0,
          padding: '28px 0',
        }}
      >
        <Container style={{ maxWidth: '480px', margin: '0 auto', padding: '0 24px' }}>
          <Section style={{ marginBottom: '28px' }}>
            <Text
              style={{
                color: '#a3a3a3',
                fontSize: '11px',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                margin: '0 0 6px',
              }}
            >
              TrackZAN
            </Text>
            <Heading
              as="h1"
              style={{
                color: '#fafafa',
                fontSize: '22px',
                fontWeight: 500,
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              The Basecamp
            </Heading>
          </Section>
          {children}
          <Hr style={{ borderColor: '#262626', borderStyle: 'solid', margin: '32px 0 20px' }} />
          <Text style={{ color: '#737373', fontSize: '12px', lineHeight: 1.55, margin: 0 }}>
            <Link href={origin} style={{ color: '#a3a3a3', textDecoration: 'underline' }}>
              {origin}
            </Link>
            {' · '}
            Coaching operations for athletes, parents, and coaches.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
