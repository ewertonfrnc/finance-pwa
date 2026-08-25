import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  findMailpitMessageByRecipient,
  readMailpitMessageLink,
} from './mailpit'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('local Mailpit boundary', () => {
  it('should read the first safe navigation link from an email', () => {
    expect(
      readMailpitMessageLink({
        HTML: '<a href="http://127.0.0.1:54321/auth/v1/verify?token=one&amp;type=recovery">Recover</a>',
      }),
    ).toBe('http://127.0.0.1:54321/auth/v1/verify?token=one&type=recovery')
  })

  it('should reject an email without a link', () => {
    expect(() => readMailpitMessageLink({ HTML: '<p>No link</p>' })).toThrow(
      'Local email did not contain a link.',
    )
  })

  it('should reject a hosted link from a local email', () => {
    expect(() =>
      readMailpitMessageLink({
        HTML: '<a href="https://auth.example.com/verify">Recover</a>',
      }),
    ).toThrow('Local email link must use a loopback HTTP URL.')
  })

  it('should reject a hosted Mailpit URL before making a request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    await expect(
      findMailpitMessageByRecipient('user@example.com', {
        mailpitUrl: 'https://mail.example.com',
        timeoutMs: 0,
      }),
    ).rejects.toThrow('Local Mailpit URL must use a loopback HTTP URL.')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('should return the newest message addressed to the recipient', async () => {
    const recipient = 'user@example.com'
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            messages: [
              {
                ID: 'message-id',
                Subject: 'Confirm your signup',
                To: [{ Address: recipient, Name: '' }],
              },
            ],
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            HTML: '<a href="http://127.0.0.1:5173/auth/confirm">Confirm</a>',
            ID: 'message-id',
            Subject: 'Confirm your signup',
            Text: 'Confirm your signup',
            To: [{ Address: recipient, Name: '' }],
          }),
        ),
      )

    await expect(
      findMailpitMessageByRecipient(recipient, {
        mailpitUrl: 'http://127.0.0.1:54324',
        timeoutMs: 0,
      }),
    ).resolves.toMatchObject({
      ID: 'message-id',
      Subject: 'Confirm your signup',
    })
  })
})
