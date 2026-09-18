// WHAT THIS FILE IS FOR
//   The very first thing that runs. It puts the app on the screen.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

const root = document.getElementById('root')
if (!root) throw new Error('The page is missing its root element, so the app cannot start.')
createRoot(root).render(<StrictMode><App /></StrictMode>)
