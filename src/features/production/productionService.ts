import type {
  Product,
  Recipe,
  RecipeItem,
  ProductionOrder,
  ProductionOrderItem,
  UnifiedStockMovement,
  Shrinkage,
  ShrinkageReason
} from '@/types/database'

export interface RawMaterialRequirement {
  rawMaterialId: string
  rawMaterialName: string
  quantityPerYield: number
  totalNeeded: number
  unit: string
  currentStock: number
  isSufficient: boolean
  unitCost: number
  subtotalCost: number
}

export interface ProductionCostAnalysis {
  finishedProductId: string
  quantityTarget: number
  requirements: RawMaterialRequirement[]
  totalCostEstimated: number
  costPerUnit: number
  canProduce: boolean
}

/**
 * Calcula los insumos necesarios para una orden de producción a partir de la receta (BOM),
 * verificando si el stock de materias primas alcanza y calculando el costo total.
 */
export function analyzeProductionOrder(
  recipe: Recipe,
  recipeItems: Array<RecipeItem & { rawMaterial?: Product | null }>,
  quantityTarget: number
): ProductionCostAnalysis {
  const target = Math.max(0, Number(quantityTarget) || 0)
  const yieldQty = Math.max(1, Number(recipe.yield_quantity) || 1)
  const ratio = target / yieldQty

  let totalCost = 0
  let canProduce = true

  const requirements: RawMaterialRequirement[] = recipeItems.map((item) => {
    const rawProd = item.rawMaterial
    const wasteFactor = 1 + (Number(item.waste_percent) || 0) / 100
    const needed = Math.round(Number(item.quantity) * ratio * wasteFactor * 1000) / 1000
    const stock = Number(rawProd?.stock) || 0
    const unitCost = Number(rawProd?.cost_price ?? rawProd?.purchase_price) || 0
    const subtotal = Math.round(needed * unitCost * 100) / 100

    if (stock < needed) {
      canProduce = false
    }

    totalCost += subtotal

    return {
      rawMaterialId: item.raw_material_id,
      rawMaterialName: rawProd?.name || 'Insumo',
      quantityPerYield: item.quantity,
      totalNeeded: needed,
      unit: item.unit,
      currentStock: stock,
      isSufficient: stock >= needed,
      unitCost,
      subtotalCost: subtotal,
    }
  })

  totalCost = Math.round(totalCost * 100) / 100
  const costPerUnit = target > 0 ? Math.round((totalCost / target) * 100) / 100 : 0

  return {
    finishedProductId: recipe.finished_product_id,
    quantityTarget: target,
    requirements,
    totalCostEstimated: totalCost,
    costPerUnit,
    canProduce,
  }
}

export interface ProductionExecutionResult {
  updatedFinishedProduct: Product
  updatedRawMaterials: Product[]
  stockMovements: Partial<UnifiedStockMovement>[]
  realCost: number
}

/**
 * Ejecuta la producción:
 * Descuenta las materias primas consumidas,
 * Aumenta el stock del producto terminado,
 * Y genera los movimientos de stock correspondientes ('PRODUCCION' y 'CONSUMO').
 */
export function executeProduction(
  finishedProduct: Product,
  rawMaterials: Product[],
  analysis: ProductionCostAnalysis,
  userId?: string
): ProductionExecutionResult {
  if (!analysis.canProduce) {
    throw new Error('Stock insuficiente de materias primas para completar la producción.')
  }

  const movements: Partial<UnifiedStockMovement>[] = []

  // 1. Descontar materias primas
  const updatedRawMaterials: Product[] = []
  for (const req of analysis.requirements) {
    const prod = rawMaterials.find((p) => p.id === req.rawMaterialId)
    if (!prod) continue

    const prevStock = Number(prod.stock) || 0
    const newStock = Math.round((prevStock - req.totalNeeded) * 1000) / 1000

    updatedRawMaterials.push({
      ...prod,
      stock: newStock,
    })

    movements.push({
      business_id: prod.business_id,
      product_id: prod.id,
      type: 'CONSUMO',
      quantity: -req.totalNeeded,
      quantity_before: prevStock,
      quantity_after: newStock,
      reason: `Consumo para producción de ${analysis.quantityTarget} u de ${finishedProduct.name}`,
      user_id: userId || null,
      created_at: new Date().toISOString(),
    })
  }

  // 2. Aumentar producto terminado
  const prevFinishedStock = Number(finishedProduct.stock) || 0
  const newFinishedStock = Math.round((prevFinishedStock + analysis.quantityTarget) * 1000) / 1000

  const updatedFinishedProduct: Product = {
    ...finishedProduct,
    stock: newFinishedStock,
    purchase_price: analysis.costPerUnit > 0 ? analysis.costPerUnit : finishedProduct.purchase_price,
    cost_price: analysis.costPerUnit > 0 ? analysis.costPerUnit : finishedProduct.cost_price,
  }

  movements.push({
    business_id: finishedProduct.business_id,
    product_id: finishedProduct.id,
    type: 'PRODUCCION',
    quantity: analysis.quantityTarget,
    quantity_before: prevFinishedStock,
    quantity_after: newFinishedStock,
    reason: `Orden de producción finalizada (+${analysis.quantityTarget} u)`,
    user_id: userId || null,
    created_at: new Date().toISOString(),
  })

  return {
    updatedFinishedProduct,
    updatedRawMaterials,
    stockMovements: movements,
    realCost: analysis.totalCostEstimated,
  }
}

/**
 * Registra una merma o rotura de inventario,
 * descontando el stock y generando trazabilidad monetaria y de movimiento.
 */
export function registerShrinkage(
  product: Product,
  quantity: number,
  reason: ShrinkageReason,
  notes?: string,
  userId?: string
): { updatedProduct: Product; shrinkage: Partial<Shrinkage>; movement: Partial<UnifiedStockMovement> } {
  const qty = Math.max(0, Number(quantity) || 0)
  if (qty <= 0) {
    throw new Error('La cantidad de merma debe ser mayor a cero.')
  }

  const prevStock = Number(product.stock) || 0
  const newStock = Math.round((prevStock - qty) * 1000) / 1000
  const unitCost = Number(product.cost_price ?? product.purchase_price) || 0
  const totalCost = Math.round(qty * unitCost * 100) / 100

  const updatedProduct: Product = {
    ...product,
    stock: newStock,
  }

  const shrinkage: Partial<Shrinkage> = {
    business_id: product.business_id,
    product_id: product.id,
    quantity: qty,
    reason,
    unit_cost: unitCost,
    total_cost: totalCost,
    notes: notes || null,
    user_id: userId || null,
    created_at: new Date().toISOString(),
  }

  const movement: Partial<UnifiedStockMovement> = {
    business_id: product.business_id,
    product_id: product.id,
    type: 'MERMA',
    quantity: -qty,
    quantity_before: prevStock,
    quantity_after: newStock,
    reason: `Merma por ${reason}${notes ? `: ${notes}` : ''} (Pérdida: $${totalCost})`,
    user_id: userId || null,
    created_at: new Date().toISOString(),
  }

  return { updatedProduct, shrinkage, movement }
}
