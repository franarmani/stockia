export interface WarehouseTransferResult {
  fromWarehouseStock: number
  toWarehouseStock: number
  quantityTransferred: number
  isTotalStockPreserved: boolean
}

/**
 * Realiza la transferencia de stock entre dos depósitos o entre el Local y un depósito.
 * Garantiza la invariante de conservación de stock (el stock total no aumenta ni disminuye).
 */
export function executeWarehouseStockTransfer(
  fromCurrentStock: number,
  toCurrentStock: number,
  quantity: number
): WarehouseTransferResult {
  const qty = Number(quantity) || 0
  if (qty <= 0) {
    throw new Error('La cantidad a transferir debe ser mayor a cero.')
  }
  if (fromCurrentStock < qty) {
    throw new Error(`Stock insuficiente en el depósito de origen. Disponible: ${fromCurrentStock}, Solicitado: ${qty}`)
  }

  const initialTotal = fromCurrentStock + toCurrentStock
  const newFrom = Math.round((fromCurrentStock - qty) * 1000) / 1000
  const newTo = Math.round((toCurrentStock + qty) * 1000) / 1000
  const finalTotal = newFrom + newTo

  return {
    fromWarehouseStock: newFrom,
    toWarehouseStock: newTo,
    quantityTransferred: qty,
    isTotalStockPreserved: Math.abs(initialTotal - finalTotal) < 0.0001,
  }
}

