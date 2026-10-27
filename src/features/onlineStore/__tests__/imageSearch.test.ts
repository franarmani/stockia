import { describe, expect, it } from 'vitest'
import { buildImageQuery, isSafeImageUrl, parseBingImages, parseGoogleImages } from '../../../../supabase/functions/_shared/imageSearch'

describe('búsqueda de fotos de producto', () => {
  it('siempre pide producto con fondo blanco', () => {
    expect(buildImageQuery('  Cemento   Loma Negra 50 kg ')).toBe('Cemento Loma Negra 50 kg producto fondo blanco')
  })
  it('solo acepta https a dominios públicos', () => {
    expect(isSafeImageUrl('https://images.ejemplo.com/a.png')).toBe(true)
    for (const bad of ['http://x.com/a.png', 'https://localhost/a.png', 'https://127.0.0.1/a.png', 'https://10.0.0.5/a.png',
      'https://[::1]/a.png', 'https://metadata.google.internal/x', 'https://servidor.local/a.png', 'https://u:p@x.com/a.png',
      'https://x.com:8080/a.png', 'file:///etc/passwd', 'no es url']) {
      expect(isSafeImageUrl(bad), bad).toBe(false)
    }
  })
  it('convierte la respuesta de Google y descarta enlaces no seguros', () => {
    const results = parseGoogleImages({ items: [
      { title: 'Cemento', link: 'https://a.com/c.png', image: { thumbnailLink: 'https://t.com/c.jpg', width: 800, height: 800, contextLink: 'https://a.com/p' } },
      { title: 'Malo', link: 'http://a.com/c.png', image: { thumbnailLink: 'https://t.com/c.jpg' } },
    ] })
    expect(results).toEqual([{ url: 'https://a.com/c.png', thumbnail: 'https://t.com/c.jpg', width: 800, height: 800, title: 'Cemento', source: 'https://a.com/p' }])
    expect(parseGoogleImages({})).toEqual([])
  })
})

describe('lectura de Bing', () => {
  const item = (data: object) => `<a class="iusc" style="height:180px" m="${JSON.stringify(data).replace(/"/g, '&quot;').replace(/&/g, '&amp;').replace(/&amp;quot;/g, '&quot;')}">`
  it('extrae las fotos, sin repetidas ni inseguras', () => {
    const html = [
      item({ murl: 'https://i.com/a.jpg?w=2000&h=2000', turl: 'https://ts1.mm.bing.net/th?id=A&pid=15.1', t: 'Taladro \ue000Bosch\ue001', purl: 'https://tienda.com/p' }),
      item({ murl: 'https://i.com/a.jpg?w=2000&h=2000', turl: 'https://ts1.mm.bing.net/th?id=A' }),
      item({ murl: 'http://i.com/b.jpg', turl: 'https://ts1.mm.bing.net/th?id=B' }),
    ].join('')
    expect(parseBingImages(html)).toEqual([{ url: 'https://i.com/a.jpg?w=2000&h=2000', thumbnail: 'https://ts1.mm.bing.net/th?id=A&pid=15.1', width: 0, height: 0, title: 'Taladro Bosch', source: 'https://tienda.com/p' }])
  })
  it('sin resultados devuelve lista vacía', () => {
    expect(parseBingImages('<html>captcha</html>')).toEqual([])
  })
})
