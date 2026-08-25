import { describe, expect, it } from 'vitest'

import { createLocalAuthAdminClient } from './auth-admin'

describe('local Auth admin boundary', () => {
  it('should reject a hosted Supabase API URL', () => {
    expect(() =>
      createLocalAuthAdminClient({
        apiUrl: 'https://project.supabase.co',
        serviceRoleKey: 'test-service-role-key',
      }),
    ).toThrow('Local Supabase API URL must use a loopback HTTP URL.')
  })

  it('should reject a hostname that only contains a loopback name', () => {
    expect(() =>
      createLocalAuthAdminClient({
        apiUrl: 'https://localhost.example.com',
        serviceRoleKey: 'test-service-role-key',
      }),
    ).toThrow('Local Supabase API URL must use a loopback HTTP URL.')
  })

  it('should reject a hostname that starts with a loopback octet', () => {
    expect(() =>
      createLocalAuthAdminClient({
        apiUrl: 'https://127.example.com',
        serviceRoleKey: 'test-service-role-key',
      }),
    ).toThrow('Local Supabase API URL must use a loopback HTTP URL.')
  })
})
