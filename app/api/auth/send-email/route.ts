import { GenericAuthEmail } from '@/emails/generic-auth'
import { InviteUserEmail } from '@/emails/invite-user'
import { MagicLinkEmail } from '@/emails/magic-link'
import { ResetPasswordEmail } from '@/emails/reset-password'
import { SignupConfirmEmail } from '@/emails/signup-confirm'
import { authEmailSubject } from '@/lib/emails/auth-email-subjects'
import { buildAuthVerifyUrl } from '@/lib/emails/auth-verify-url'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import * as React from 'react'
import { Webhook } from 'standardwebhooks'

export const runtime = 'nodejs'

type SendEmailPayload = {
  user: { email: string }
  email_data: {
    token: string
    token_hash: string
    redirect_to?: string
    email_action_type: string
    site_url: string
    token_new?: string
    token_hash_new?: string
    old_email?: string
    new_email?: string
  }
}

function isSendEmailPayload(x: unknown): x is SendEmailPayload {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  const user = o.user as Record<string, unknown> | undefined
  const ed = o.email_data as Record<string, unknown> | undefined
  return (
    typeof user?.email === 'string' &&
    typeof ed?.token_hash === 'string' &&
    typeof ed?.email_action_type === 'string' &&
    typeof ed?.site_url === 'string' &&
    typeof ed?.token === 'string'
  )
}

function headersRecord(request: Request): Record<string, string> {
  const out: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    out[key] = value
  })
  return out
}

function normalizeHookSecret(raw: string): string {
  if (raw.startsWith('v1,')) {
    return raw.slice(3)
  }
  return raw
}

function hookError(message: string, status: number) {
  return NextResponse.json(
    {
      error: {
        http_code: status,
        message,
      },
    },
    { status },
  )
}

function renderAuthEmailElement(
  action: string,
  args: {
    confirmationUrl: string
    userEmail: string
    siteUrl: string
    token?: string
    email_data: SendEmailPayload['email_data']
  },
): React.ReactElement {
  const { confirmationUrl, userEmail, siteUrl, token, email_data } = args

  switch (action) {
    case 'invite':
      return React.createElement(InviteUserEmail, {
        confirmationUrl,
        email: userEmail,
        siteUrl,
      })
    case 'recovery':
      return React.createElement(ResetPasswordEmail, {
        confirmationUrl,
        email: userEmail,
        siteUrl,
        token,
      })
    case 'signup':
      return React.createElement(SignupConfirmEmail, {
        confirmationUrl,
        email: userEmail,
        siteUrl,
        token,
      })
    case 'magiclink':
      return React.createElement(MagicLinkEmail, {
        confirmationUrl,
        email: userEmail,
        siteUrl,
        token,
      })
    case 'email_change':
      return React.createElement(GenericAuthEmail, {
        confirmationUrl,
        email: userEmail,
        siteUrl,
        title: 'Confirm email change',
        body: `Confirm updating your email${email_data.old_email ? ` from ${email_data.old_email}` : ''}${email_data.new_email ? ` to ${email_data.new_email}` : ''}.`,
        ctaLabel: 'Confirm change',
        token,
      })
    case 'email_change_new':
      return React.createElement(GenericAuthEmail, {
        confirmationUrl,
        email: userEmail,
        siteUrl,
        title: 'Confirm your new email',
        body: 'Use the link below to verify this new address for your TrackZAN account.',
        ctaLabel: 'Confirm new email',
        token: email_data.token_new || token,
      })
    case 'reauthentication':
      return React.createElement(GenericAuthEmail, {
        confirmationUrl,
        email: userEmail,
        siteUrl,
        title: 'Confirm it is you',
        body: 'We need a quick confirmation before this sensitive change.',
        ctaLabel: 'Confirm',
        token,
      })
    default:
      return React.createElement(GenericAuthEmail, {
        confirmationUrl,
        email: userEmail,
        siteUrl,
        title: 'TrackZAN',
        body: `Action required (${action}). Use the secure link below.`,
        ctaLabel: 'Continue',
        token,
      })
  }
}

export async function POST(request: Request) {
  const rawSecret = process.env.SEND_EMAIL_HOOK_SECRET
  const resendKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!rawSecret?.trim()) {
    return hookError('SEND_EMAIL_HOOK_SECRET is not configured', 500)
  }
  if (!resendKey?.trim()) {
    return hookError('RESEND_API_KEY is not configured', 500)
  }
  if (!from?.trim()) {
    return hookError('RESEND_FROM_EMAIL is not configured', 500)
  }
  if (!supabaseUrl?.trim()) {
    return hookError('NEXT_PUBLIC_SUPABASE_URL is not configured', 500)
  }

  const payloadText = await request.text()
  const wh = new Webhook(normalizeHookSecret(rawSecret.trim()))

  let parsed: unknown
  try {
    parsed = wh.verify(payloadText, headersRecord(request))
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Webhook verification failed'
    return hookError(msg, 401)
  }

  if (!isSendEmailPayload(parsed)) {
    return hookError('Invalid hook payload', 400)
  }

  const { user, email_data } = parsed
  let confirmationUrl: string
  try {
    const redirectTo =
      email_data.redirect_to && email_data.redirect_to.trim() !== ''
        ? email_data.redirect_to
        : email_data.site_url
    confirmationUrl = buildAuthVerifyUrl(supabaseUrl, {
      token_hash: email_data.token_hash,
      email_action_type: email_data.email_action_type,
      redirect_to: redirectTo,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not build verify URL'
    return hookError(msg, 500)
  }

  const siteUrl = email_data.site_url || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const action = email_data.email_action_type
  const subject = authEmailSubject(action)
  const token = email_data.token?.trim() || undefined

  const element = renderAuthEmailElement(action, {
    confirmationUrl,
    userEmail: user.email,
    siteUrl,
    token,
    email_data,
  })

  const resend = new Resend(resendKey)
  const { error: sendErr } = await resend.emails.send({
    from,
    to: user.email,
    subject,
    react: element,
  })

  if (sendErr) {
    return hookError(sendErr.message, 500)
  }

  return NextResponse.json({})
}
