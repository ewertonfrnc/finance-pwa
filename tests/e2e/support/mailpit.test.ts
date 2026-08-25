import { afterEach, describe, expect, it, vi } from 'vitest'

import { findMailpitMessageByRecipient } from './mailpit'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('local Mailpit boundary', () => {
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
