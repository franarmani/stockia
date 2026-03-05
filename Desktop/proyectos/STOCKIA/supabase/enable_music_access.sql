-- Habilitar STOCKIA Music para todos los negocios existentes
INSERT INTO business_music_access (business_id, enabled, plan_tier)
SELECT id, true, 'premium'
FROM businesses
ON CONFLICT (business_id) DO UPDATE SET enabled = true, plan_tier = 'premium';

-- Verificar resultado
SELECT b.name, bma.enabled, bma.plan_tier
FROM business_music_access bma
JOIN businesses b ON b.id = bma.business_id;
