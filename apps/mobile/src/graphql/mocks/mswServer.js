import { setupServer } from 'msw/native'
import handlers from './handlers.js'

export const server = setupServer(...handlers)
