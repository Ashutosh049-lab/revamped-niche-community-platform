import { Link, Route, Routes } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { onConnect } from './lib/socket'

function Home() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Revamped Niche Community Platform</h1>
      <p className="text-gray-600 mt-2">Real-time discussions, recommendations, and engagement tools.</p>
    </div>
  )
}

function Communities() {
  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold">Communities</h2>
      <p className="text-gray-600 mt-2">Explore and join interest-based groups.</p>
    </div>
  )
}

export default function App() {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    onConnect(() => setConnected(true))
  }, [])

  return (
    <div className="app-container">
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <nav className="flex items-center gap-4">
          <Link to="/" className="font-medium text-blue-600">Home</Link>
          <Link to="/communities" className="font-medium text-blue-600">Communities</Link>
        </nav>
        <div className={`text-sm ${connected ? 'text-green-600' : 'text-gray-500'}`}>
          {connected ? 'Live: connected' : 'Connecting...'}
        </div>
      </header>
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/communities" element={<Communities />} />
        </Routes>
      </main>
    </div>
  )
}
