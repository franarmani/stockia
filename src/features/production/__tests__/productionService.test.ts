import { describe, it, expect } from 'vitest'
import { analyzeProductionOrder, executeProduction, registerShrinkage } from '../productionService'
import type { Product, Recipe, RecipeItem } from '@/types/database'

describe('Recetas, Producción y Mermas', () => {
  const materiaPrimaA: Product = {
    id: 'raw-a',
    business_id: 'biz-1',
    name: 'Materia Prima A',
    stock: 50,
    cost_price: 200,
    sale_price: 0,
    product_type: 'raw_material',
    unit: 'u',
    active: true,
    created_at: new Date().toISOString(),
  } as any

  const productoTerminado: Product = {
    id: 'prod-finish',
    business_id: 'biz-1',
    name: 'Hamburguesa Completa',
    stock: 5,
    cost_price: 500,
    sale_price: 1500,
    product_type: 'finished',
    unit: 'u',
    active: true,
    created_at: new Date().toISOString(),
  } as any

  const recipe: Recipe = {
    id: 'rec-1',
    business_id: 'biz-1',
    finished_product_id: 'prod-finish',
    yield_quantity: 1, // 1 hamburguesa
    notes: 'Receta hamburguesa',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const recipeItemA: RecipeItem = {
    id: 'item-1',
    recipe_id: 'rec-1',
    raw_material_id: 'raw-a',
    quantity: 2, // Requiere 2 unidades de A por cada unidad terminada
    unit: 'u',
    waste_percent: 0,
    created_at: new Date().toISOString(),
  }

  it('verifies spec #34 test case: Producing 10 units with recipe (2 of A) deducts exactly 20 of A', () => {
    const analysis = analyzeProductionOrder(
      recipe,
      [{ ...recipeItemA, rawMaterial: materiaPrimaA }],
      10 // Producir 10 unidades
    )

    expect(analysis.quantityTarget).toBe(10)
    expect(analysis.requirements[0].totalNeeded).toBe(20) // 10 * 2 = 20
    expect(analysis.canProduce).toBe(true)
    expect(analysis.totalCostEstimated).toBe(4000) // 20 * $200 = $4000

    const execution = executeProduction(
      productoTerminado,
      [materiaPrimaA],
      analysis
    )

    // Stock de Materia Prima A: pasó de 50 a 30 (-20 unidades)
    const rawUpdated = execution.updatedRawMaterials.find(p => p.id === 'raw-a')
    expect(rawUpdated?.stock).toBe(30)

    // Stock de Producto Terminado: pasó de 5 a 15 (+10 unidades)
    expect(execution.updatedFinishedProduct.stock).toBe(15)

    // Movimientos generados
    expect(execution.stockMovements).toHaveLength(2)
    expect(execution.stockMovements[0].type).toBe('CONSUMO')
    expect(execution.stockMovements[0].quantity).toBe(-20)
    expect(execution.stockMovements[1].type).toBe('PRODUCCION')
    expect(execution.stockMovements[1].quantity).toBe(10)
  })

  it('blocks production when raw material stock is insufficient', () => {
    const analysis = analyzeProductionOrder(
      recipe,
      [{ ...recipeItemA, rawMaterial: { ...materiaPrimaA, stock: 15 } }],
      10 // Necesita 20, pero solo hay 15
    )

    expect(analysis.canProduce).toBe(false)
    expect(() =>
      executeProduction(productoTerminado, [{ ...materiaPrimaA, stock: 15 }], analysis)
    ).toThrow('Stock insuficiente')
  })

  it('registers shrinkage properly calculating monetary loss and updating stock', () => {
    // 3 unidades de hamburguesas vencidas/rotas a costo $500 c/u = $1500 pérdida
    const res = registerShrinkage(productoTerminado, 3, 'breakage', 'Rotura de envoltorio')
    expect(res.updatedProduct.stock).toBe(2) // 5 - 3 = 2
    expect(res.shrinkage.total_cost).toBe(1500)
    expect(res.movement.type).toBe('MERMA')
    expect(res.movement.quantity).toBe(-3)
  })
})

