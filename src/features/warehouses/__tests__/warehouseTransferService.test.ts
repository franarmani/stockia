import { describe, it, expect } from 'vitest'
import { executeWarehouseStockTransfer } from '../warehouseTransferService'

describe('Transferencias entre Depósitos y Almacenes', () => {
  it('validates spec #34 test case: Depósito A 100, Transferencia 20 -> A = 80, B = 20, sin duplicar stock', () => {
    // Depósito A = 100, Depósito B = 0
    const result = executeWarehouseStockTransfer(100, 0, 20)

    expect(result.fromWarehouseStock).toBe(80)
    expect(result.toWarehouseStock).toBe(20)
    expect(result.quantityTransferred).toBe(20)
    expect(result.isTotalStockPreserved).toBe(true)
    expect(result.fromWarehouseStock + result.toWarehouseStock).toBe(100)
  })

  it('rejects transfer when origin stock is insufficient', () => {
    expect(() => executeWarehouseStockTransfer(10, 0, 20)).toThrow('Stock insuficiente')
  })
})

