import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { CheckCircle2, Loader2, QrCode, XCircle } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { formatCurrency } from '@/lib/utils'
import { mpQr, type QrOrderState } from './mpQrService'

const POLL_MS = 2500

/** Muestra el QR de Mercado Pago y espera el pago del cliente. */
export default function QrPaymentModal({
  open,
  amount,
  reference,
  description,
  onPaid,
  onClose,
}: {
  open: boolean
  amount: number
  reference: string
  description: string
  onPaid: (orderId: string) => void
  onClose: () => void
}) {
  const [image, setImage] = useState<string | null>(null)
  const [state, setState] = useState<QrOrderState | 'creating' | 'error'>('creating')
  const [error, setError] = useState('')
  const orderId = useRef<string | null>(null)
  const finished = useRef(false)

  useEffect(() => {
    if (!open) return
    finished.current = false
    orderId.current = null
    setImage(null)
    setError('')
    setState('creating')

    let timer: ReturnType<typeof setInterval> | undefined
    mpQr.create({ amount, reference, description })
      .then(async (order) => {
        if (!order.qr_data) throw new Error('Mercado Pago no devolvió el código QR')
        orderId.current = order.order_id
        setImage(await QRCode.toDataURL(order.qr_data, { width: 280, margin: 1 }))
        setState('pending')
        timer = setInterval(async () => {
          if (finished.current || !orderId.current) return
          try {
            const result = await mpQr.check(orderId.current)
            if (result.state === 'paid') {
              finished.current = true
              setState('paid')
              clearInterval(timer)
              setTimeout(() => onPaid(orderId.current!), 900)
            } else if (result.state !== 'pending') {
              finished.current = true
              setState(result.state)
              clearInterval(timer)
            }
          } catch {
            // Un corte momentáneo no cancela el cobro: se vuelve a consultar.
          }
        }, POLL_MS)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'No se pudo generar el QR')
        setState('error')
      })

    return () => clearInterval(timer)
  }, [open, reference])

  async function cancel() {
    if (orderId.current && !finished.current) {
      finished.current = true
      try {
        const result = await mpQr.cancel(orderId.current)
        // Si el cliente justo pagó, no se pierde el cobro.
        if (result.state === 'paid') { setState('paid'); onPaid(orderId.current); return }
      } catch {}
    }
    onClose()
  }

  return (
    <Modal open={open} onClose={cancel} title="Cobro con QR de Mercado Pago" size="sm">
      <div className="flex flex-col items-center text-center gap-4 py-2">
        <p className="text-3xl font-black text-white tabular-nums">{formatCurrency(amount)}</p>

        {state === 'creating' && <Loader2 className="w-10 h-10 text-primary animate-spin my-16" />}

        {state === 'pending' && image && (
          <>
            <img src={image} alt="Código QR para pagar" className="w-64 h-64 rounded-2xl bg-white p-2" />
            <p className="text-sm text-white/60 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Esperando que el cliente pague con la app de Mercado Pago…
            </p>
          </>
        )}

        {state === 'paid' && (
          <div className="py-10">
            <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" />
            <p className="mt-3 text-lg font-bold text-white">¡Pago recibido!</p>
          </div>
        )}

        {(state === 'expired' || state === 'canceled' || state === 'refunded' || state === 'error') && (
          <div className="py-8">
            <XCircle className="w-14 h-14 text-red-400 mx-auto" />
            <p className="mt-3 font-semibold text-white">
              {state === 'expired' ? 'El QR venció sin pago' : state === 'error' ? 'No se pudo generar el QR' : 'El cobro se canceló'}
            </p>
            {error && <p className="mt-1 text-xs text-white/50">{error}</p>}
          </div>
        )}

        {state !== 'paid' && (
          <button onClick={cancel} className="h-10 px-5 rounded-xl bg-white/5 text-white/70 text-sm font-semibold hover:bg-white/10 flex items-center gap-2">
            <QrCode className="w-4 h-4" /> {state === 'pending' || state === 'creating' ? 'Cancelar cobro' : 'Cerrar'}
          </button>
        )}
      </div>
    </Modal>
  )
}
