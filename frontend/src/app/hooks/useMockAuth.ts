import { useState } from 'react'

import { defaultMockAccount } from '../data'
import type { AuthResult, MockAccount, Role } from '../types'

export function useMockAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [role] = useState<Role>('traveler')
  const [currentAccount, setCurrentAccount] = useState<MockAccount>(defaultMockAccount)
  const [createdAccount, setCreatedAccount] = useState<MockAccount | null>(null)

  const handleCreateAccount = (account: MockAccount) => {
    setCreatedAccount(account)
    setCurrentAccount(account)
    setIsLoggedIn(false)
  }

  const handleLogout = () => {
    setIsLoggedIn(false)
  }

  const handleLogin = (identifier: string, password: string): AuthResult => {
    if (!createdAccount) {
      return {
        success: false,
        message:
          'Create an account first. Until backend auth is added, this sign-in only checks the account created in this session.',
      }
    }

    const normalizedIdentifier = identifier.toLowerCase()
    const isMatchingIdentifier =
      createdAccount.userId.toLowerCase() === normalizedIdentifier ||
      createdAccount.email.toLowerCase() === normalizedIdentifier

    if (!isMatchingIdentifier || createdAccount.password !== password) {
      return {
        success: false,
        message: 'ID/email or password does not match the created account.',
      }
    }

    setCurrentAccount(createdAccount)
    setIsLoggedIn(true)
    return { success: true }
  }

  const userDisplayName = `${currentAccount.firstName} ${currentAccount.lastName}`.trim()

  return {
    createdAccount,
    currentAccount,
    handleCreateAccount,
    handleLogin,
    handleLogout,
    isLoggedIn,
    role,
    userDisplayName,
  }
}
