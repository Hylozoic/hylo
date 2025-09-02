import React from 'react'
import { View, Text } from 'react-native'

/**
 * Diagnostic component to log missing thread data in development
 * This helps identify what data is becoming null/undefined and causing crashes
 */
export default function ThreadDataDiagnostic ({ message, currentUser, participants, threadId }) {
  // Only run diagnostics in development
  if (process.env.NODE_ENV !== 'development') return null

  const issues = []

  // Check for missing essential data
  if (!message) {
    issues.push('message is null/undefined')
  } else {
    if (!message.id) issues.push('message.id is missing')
    if (!message.text) issues.push('message.text is missing')
    if (!message.createdAt) issues.push('message.createdAt is missing')
    if (!message.creator) {
      issues.push('message.creator is null/undefined')
    } else {
      if (!message.creator.id) issues.push('message.creator.id is missing')
      if (!message.creator.name) issues.push('message.creator.name is missing')
    }
  }

  if (!currentUser) {
    issues.push('currentUser is null/undefined')
  } else {
    if (!currentUser.id) issues.push('currentUser.id is missing')
    if (!currentUser.name) issues.push('currentUser.name is missing')
  }

  if (!participants) {
    issues.push('participants is null/undefined')
  } else if (!Array.isArray(participants)) {
    issues.push('participants is not an array')
  } else {
    participants.forEach((participant, index) => {
      if (!participant) {
        issues.push(`participants[${index}] is null/undefined`)
      } else {
        if (!participant.id) issues.push(`participants[${index}].id is missing`)
        if (!participant.name) issues.push(`participants[${index}].name is missing`)
      }
    })
  }

  // Log issues to console for debugging
  if (issues.length > 0) {
    console.warn(`ThreadCard Data Issues (threadId: ${threadId}):`, issues)
    console.warn('Full data:', { message, currentUser, participants })
  }

  // Don't render anything in the UI
  return null
}
