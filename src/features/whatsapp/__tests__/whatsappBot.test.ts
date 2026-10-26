import { describe, expect, it } from 'vitest'
import { buildSystemPrompt, isPaused, parseIncoming, searchTerms, splitHumanMarker, wantsHuman, zapiUrl } from '../../../../supabase/functions/_shared/whatsappBot'

const message = (overrides = {}) => ({
  type: 'ReceivedCallback', isGroup: false, isNewsletter: false, isStatusReply: false, broadcast: false,
  fromMe: false, phone: '5492915551234', messageId: 'ABC', senderName: 'Ana', text: { message: 'Hola, tienen yerba playadito?' },
  ...overrides,
})

describe('WhatsApp AI assistant', () => {
  it('only handles text messages from individual chats', () => {
    expect(parseIncoming(message())).toEqual({ phone: '5492915551234', text: 'Hola, tienen yerba playadito?', name: 'Ana', messageId: 'ABC', fromMe: false })
    expect(parseIncoming(message({ isGroup: true }))).toBeNull()
    expect(parseIncoming(message({ isNewsletter: true }))).toBeNull()
    expect(parseIncoming(message({ isStatusReply: true }))).toBeNull()
    expect(parseIncoming(message({ text: undefined, image: {} }))).toBeNull()
    expect(parseIncoming(message({ type: 'MessageStatusCallback' }))).toBeNull()
    expect(parseIncoming(message({ fromMe: true }))?.fromMe).toBe(true)
  })

  it('extracts catalog search words from the customer message', () => {
    expect(searchTerms('Hola! Cuánto sale la yerba Playadito de 1kg?')).toEqual(['yerba', 'playadito', '1kg'])
    expect(searchTerms('hola buenas')).toEqual([])
  })

  it('detects requests to talk to a person', () => {
    expect(wantsHuman('quiero hablar con una persona')).toBe(true)
    expect(wantsHuman('tengo un reclamo')).toBe(true)
    expect(wantsHuman('tienen pan?')).toBe(false)
  })

  it('respects the pause while staff is answering', () => {
    const now = new Date('2026-10-26T12:00:00Z')
    expect(isPaused('2026-10-26T13:00:00Z', now)).toBe(true)
    expect(isPaused('2026-10-26T11:00:00Z', now)).toBe(false)
    expect(isPaused(null, now)).toBe(false)
  })

  it('grounds the assistant in real prices and store data only', () => {
    const prompt = buildSystemPrompt({
      businessName: 'Almacén Don José', address: 'Alsina 123', phone: null, storeUrl: 'https://x/tienda/don-jose',
      instructions: 'Abrimos de 9 a 20.', products: [{ name: 'Yerba Playadito 1kg', sale_price: 4900, stock: 3, unit: 'u' }],
      now: new Date('2026-10-26T15:00:00Z'),
    })
    expect(prompt).toContain('Nunca inventes precios')
    expect(prompt).toContain('Yerba Playadito 1kg: $4.900 (hay stock)')
    expect(prompt).toContain('https://x/tienda/don-jose')
    expect(prompt).toContain('Abrimos de 9 a 20.')
  })

  it('separates the handoff marker from the reply', () => {
    expect(splitHumanMarker('En breve te atiende alguien del local. [HUMANO]')).toEqual({ text: 'En breve te atiende alguien del local.', handoff: true })
    expect(splitHumanMarker('Sí, tenemos.')).toEqual({ text: 'Sí, tenemos.', handoff: false })
  })

  it('builds Z-API endpoint URLs', () => {
    expect(zapiUrl('INST', 'TOK', 'send-text')).toBe('https://api.z-api.io/instances/INST/token/TOK/send-text')
  })
})
