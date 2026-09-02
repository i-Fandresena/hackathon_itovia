import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MessageCircle, Send } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Loading } from '../../components/ui/Loading'
import { useApp } from '../../context/AppContext'
import {
  apiConversationMessages,
  apiContactOffrec,
  apiMyConversations,
  apiSendMessage,
  type ConversationMessage,
  type ConversationSummary,
} from '../../lib/api'
import { formatDate } from '../../lib/format'
import './Messages.css'

export function Messages() {
  const { currentUser } = useApp()
  const isRecruiter = currentUser?.role === 'recruiter'
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get('c')

  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[] | null>(null)
  const [draft, setDraft] = useState('')
  const [newMessage, setNewMessage] = useState('')

  const loadConversations = () => {
    apiMyConversations().then(setConversations)
  }

  useEffect(() => {
    loadConversations()
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setMessages(null)
      return
    }
    apiConversationMessages(selectedId).then(setMessages)
  }, [selectedId])

  const handleSend = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedId || !draft.trim()) return
    const { message } = await apiSendMessage(selectedId, draft.trim())
    setMessages((m) => (m ? [...m, message] : [message]))
    setDraft('')
    loadConversations()
  }

  const handleContactOffrec = async (e: FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim()) return
    const { conversationId } = await apiContactOffrec(newMessage.trim())
    setNewMessage('')
    loadConversations()
    setSearchParams({ c: conversationId })
  }

  if (!conversations) {
    return (
      <div className="page">
        <div className="container">
          <Loading />
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="container">
        <header className="page-header">
          <h1>{isRecruiter ? 'Discuter avec OffRec' : 'Messages'}</h1>
          <p>
            {isRecruiter
              ? 'Échangez avec l’équipe OffRec — questions sur vos offres, vos candidats proposés ou une mise en relation.'
              : 'Échangez directement avec les recruteurs et candidats.'}
          </p>
        </header>

        {conversations.length === 0 ? (
          isRecruiter ? (
            <Card>
              <h2 style={{ fontSize: '1.05rem', marginBottom: '0.5rem' }}>Contacter OffRec</h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                Aucune conversation pour l’instant — écrivez à l’équipe OffRec pour démarrer.
              </p>
              <form onSubmit={handleContactOffrec} className="msg-form" style={{ borderTop: 'none', paddingTop: 0 }}>
                <input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Votre message à OffRec…"
                />
                <Button type="submit">
                  <Send size={16} />
                  Envoyer
                </Button>
              </form>
            </Card>
          ) : (
            <EmptyState
              icon={MessageCircle}
              title="Aucune conversation"
              description="Postulez à une offre ou contactez un recruteur pour démarrer une conversation."
            />
          )
        ) : (
          <div className="msg-layout">
            <div className="msg-list">
              {conversations.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`msg-list-item ${c.id === selectedId ? 'active' : ''}`}
                  onClick={() => setSearchParams({ c: c.id })}
                >
                  <span className="msg-list-name">
                    {c.otherUser.displayName}
                    {c.unreadCount > 0 && <span className="msg-badge">{c.unreadCount}</span>}
                  </span>
                  {c.lastMessage && <span className="msg-list-preview">{c.lastMessage.content}</span>}
                </button>
              ))}
            </div>

            <Card className="msg-thread">
              {!selectedId || !messages ? (
                <p style={{ color: 'var(--color-text-muted)' }}>Sélectionnez une conversation.</p>
              ) : (
                <>
                  <div className="msg-thread-body">
                    {messages.map((m) => (
                      <div key={m.id} className={`msg-bubble ${m.mine ? 'mine' : ''}`}>
                        <p>{m.content}</p>
                        <time>{formatDate(m.createdAt)}</time>
                      </div>
                    ))}
                  </div>
                  <form className="msg-form" onSubmit={handleSend}>
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Votre message…"
                    />
                    <button type="submit" aria-label="Envoyer">
                      <Send size={18} />
                    </button>
                  </form>
                </>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
