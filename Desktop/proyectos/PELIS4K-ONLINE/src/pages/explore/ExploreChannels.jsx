import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./stylechannel.scss";
import SportsAgenda from "../../components/SportsAgenda/SportsAgenda";

// Componente del botón flotante para volver arriba
const FloatingBackToTopButton = () => {
    useEffect(() => {
        // Crear el botón como elemento flotante independiente
        const backToTopBtn = document.createElement('button');
        backToTopBtn.innerHTML = '↑';
        backToTopBtn.className = 'floating-back-to-top-btn';
        backToTopBtn.title = 'Volver arriba';
        backToTopBtn.id = 'floating-back-to-top-unique';
        
        // Estilos inline CRÍTICOS para asegurar máxima visibilidad
        Object.assign(backToTopBtn.style, {
            position: 'fixed',
            bottom: '30px',
            right: '30px',
            width: '50px',
            height: '50px',
            zIndex: '2147483647', // Z-index máximo posible
            background: 'linear-gradient(135deg, #9D50BB 0%, #6A0DAD 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            fontSize: '1.5rem',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex !important',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(157, 80, 187, 0.8)',
            opacity: '1',
            visibility: 'visible',
            transition: 'all 0.3s ease',
            isolation: 'isolate',
            pointerEvents: 'auto',
            transform: 'translateZ(0)',
            webkitTransform: 'translateZ(0)',
            msTransform: 'translateZ(0)',
            backfaceVisibility: 'hidden',
            webkitBackfaceVisibility: 'hidden',
            willChange: 'transform'
        });        // Evento de click para volver arriba
        backToTopBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        // Eventos hover con mejoras
        backToTopBtn.addEventListener('mouseenter', () => {
            Object.assign(backToTopBtn.style, {
                transform: 'translateY(-3px) scale(1.1) translateZ(0)',
                boxShadow: '0 8px 30px rgba(157, 80, 187, 0.9)',
                background: 'linear-gradient(135deg, #6A0DAD 0%, #9D50BB 100%)'
            });
        });

        backToTopBtn.addEventListener('mouseleave', () => {
            Object.assign(backToTopBtn.style, {
                transform: 'translateY(0) scale(1) translateZ(0)',
                boxShadow: '0 4px 20px rgba(157, 80, 187, 0.8)',
                background: 'linear-gradient(135deg, #9D50BB 0%, #6A0DAD 100%)'
            });
        });

        // Prevenir que otros elementos interfieran
        backToTopBtn.addEventListener('focus', (e) => {
            e.target.style.outline = '2px solid rgba(157, 80, 187, 0.5)';
            e.target.style.outlineOffset = '2px';
        });

        backToTopBtn.addEventListener('blur', (e) => {
            e.target.style.outline = 'none';
        });        // Responsive design mejorado
        const handleResize = () => {
            const screenWidth = window.innerWidth;
            
            if (screenWidth <= 480) {
                Object.assign(backToTopBtn.style, {
                    width: '40px',
                    height: '40px',
                    bottom: '20px',
                    right: '20px',
                    fontSize: '1.1rem'
                });
            } else if (screenWidth <= 768) {
                Object.assign(backToTopBtn.style, {
                    width: '45px',
                    height: '45px',
                    bottom: '25px',
                    right: '25px',
                    fontSize: '1.3rem'
                });
            } else {
                Object.assign(backToTopBtn.style, {
                    width: '50px',
                    height: '50px',
                    bottom: '30px',
                    right: '30px',
                    fontSize: '1.5rem'
                });
            }
        };

        // Función para asegurar que el botón esté siempre visible
        const ensureVisibility = () => {
            if (backToTopBtn && document.body.contains(backToTopBtn)) {
                backToTopBtn.style.display = 'flex';
                backToTopBtn.style.visibility = 'visible';
                backToTopBtn.style.opacity = '1';
                backToTopBtn.style.pointerEvents = 'auto';
                backToTopBtn.style.zIndex = '2147483647';
            }
        };

        // Configurar listeners
        window.addEventListener('resize', handleResize);
        window.addEventListener('scroll', ensureVisibility);
        document.addEventListener('DOMContentLoaded', ensureVisibility);
        
        // Configurar tamaño inicial
        handleResize();

        // Asegurar visibilidad inicial
        setTimeout(ensureVisibility, 100);
        
        // Agregar al body con verificación
        if (!document.getElementById('floating-back-to-top-unique')) {
            document.body.appendChild(backToTopBtn);
        }        // Cleanup mejorado
        return () => {
            // Remover todos los event listeners
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('scroll', ensureVisibility);
            document.removeEventListener('DOMContentLoaded', ensureVisibility);
            
            // Remover el botón del DOM
            const existingBtn = document.getElementById('floating-back-to-top-unique');
            if (existingBtn && document.body.contains(existingBtn)) {
                document.body.removeChild(existingBtn);
            }
        };
    }, []);

    return null; // No renderiza nada en el componente React
};

// Componente para manejar imágenes de canales con fallback mejorado
const ChannelImage = ({ channel, index }) => {
    const [imageError, setImageError] = useState(false);
    const [currentSrc, setCurrentSrc] = useState(null);    // Lista de posibles fuentes de imagen en orden de prioridad
    const getImageSources = (channel) => {
        const sources = [];
        
        // 1. Imagen del canal si existe y es válida
        if (channel.image && typeof channel.image === 'string' && channel.image.trim()) {
            // Si la imagen ya tiene una ruta completa (http/https), usarla directamente
            if (channel.image.startsWith('http')) {
                sources.push(channel.image);
            } else {
                // Si es una ruta relativa, asegurar que esté en public
                const imagePath = channel.image.startsWith('/') ? channel.image : `/${channel.image}`;
                sources.push(imagePath);
            }
        }
        
        // 2. Archivos locales con diferentes extensiones (todas las rutas deben estar en public)
        if (channel.id) {
            const extensions = ['png', 'jpg', 'jpeg', 'webp', 'svg'];
            extensions.forEach(ext => {
                // Buscar directamente por ID
                sources.push(`/canales_imgs/${channel.id}.${ext}`);
                // También probar con prefijo CH si el ID es numérico o no lo tiene ya
                if (/^\d+$/.test(channel.id)) {
                    sources.push(`/canales_imgs/CH${channel.id}.${ext}`);
                } else if (!channel.id.startsWith('CH') && !channel.id.startsWith('ch')) {
                    sources.push(`/canales_imgs/CH${channel.id}.${ext}`);
                }
            });
            
            // Probar con variaciones del ID
            const idVariations = [
                channel.id.toUpperCase(),
                channel.id.toLowerCase(),
                channel.id.replace(/[^a-zA-Z0-9]/g, ''),
                channel.id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
            ];
            
            idVariations.forEach(variation => {
                if (variation !== channel.id) {
                    const extensions = ['png', 'jpg', 'jpeg', 'webp'];
                    extensions.forEach(ext => {
                        sources.push(`/canales_imgs/${variation}.${ext}`);
                        if (/^\d+$/.test(variation)) {
                            sources.push(`/canales_imgs/CH${variation}.${ext}`);
                        }
                    });
                }
            });
        }
        
        // 3. Buscar por nombre del canal normalizado
        if (channel.name) {
            const normalizedName = channel.name.toLowerCase()
                .replace(/[^a-z0-9]/g, '')
                .substring(0, 15);
            if (normalizedName) {
                const extensions = ['png', 'jpg', 'jpeg', 'webp'];
                extensions.forEach(ext => {
                    sources.push(`/canales_imgs/${normalizedName}.${ext}`);
                });
            }
            
            // También probar con palabras clave del nombre
            const keywords = channel.name.toLowerCase().split(/[\s\-_]+/);
            keywords.forEach(keyword => {
                if (keyword.length >= 3) {
                    const extensions = ['png', 'jpg', 'jpeg', 'webp'];
                    extensions.forEach(ext => {
                        sources.push(`/canales_imgs/${keyword}.${ext}`);
                    });
                }
            });
        }
        
        return [...new Set(sources)]; // Remover duplicados
    };

    const [imageSources] = useState(() => getImageSources(channel));
    const [currentSourceIndex, setCurrentSourceIndex] = useState(0);

    useEffect(() => {
        if (imageSources.length > 0) {
            setCurrentSrc(imageSources[0]);
            setCurrentSourceIndex(0);
            setImageError(false);
            console.log(`🖼️ ${channel.name || channel.id}: Intentando cargar imagen desde ${imageSources.length} fuentes`);
        } else {
            setImageError(true);
            console.log(`❌ ${channel.name || channel.id}: No se encontraron fuentes de imagen`);
        }
    }, [channel.id, channel.image, channel.name]);

    const handleImageError = () => {
        const nextIndex = currentSourceIndex + 1;
        console.log(`❌ ${channel.name || channel.id}: Error cargando ${currentSrc} (${currentSourceIndex + 1}/${imageSources.length})`);
        
        if (nextIndex < imageSources.length) {
            setCurrentSourceIndex(nextIndex);
            setCurrentSrc(imageSources[nextIndex]);
            console.log(`🔄 ${channel.name || channel.id}: Probando siguiente fuente: ${imageSources[nextIndex]}`);
        } else {
            setImageError(true);
            console.log(`🚫 ${channel.name || channel.id}: Todas las fuentes fallaron, mostrando placeholder`);
        }
    };

    const handleImageLoad = () => {
        setImageError(false);
        console.log(`✅ ${channel.name || channel.id}: Imagen cargada exitosamente desde ${currentSrc}`);
    };

    return (
        <div className="channelImageContainer">
            {!imageError && currentSrc ? (
                <img
                    src={currentSrc}
                    alt={channel.name || `Canal ${index + 1}`}
                    className="channelImage"
                    loading="lazy"
                    onError={handleImageError}
                    onLoad={handleImageLoad}
                />
            ) : (
                <div className="channelPlaceholder">
                    <div className="placeholderIcon">📺</div>
                    <div className="placeholderText">
                        {channel.name ? channel.name.substring(0, 3).toUpperCase() : 'TV'}
                    </div>
                </div>
            )}
            <div className="channelOverlay">
                <div className="playIcon">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8 5v14l11-7z" fill="currentColor" />
                    </svg>
                </div>
            </div>
        </div>
    );
};

// Función helper para obtener canales desde rereyano.ru (simulada)
const obtenerCanalesRereyano = async (forzarRecarga = false) => {
    // Por ahora simular la carga desde archivo local
    const timestamp = forzarRecarga ? new Date().getTime() : '';
    const response = await fetch(`/channelData.json?t=${timestamp}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': forzarRecarga ? 'no-cache, no-store, must-revalidate' : 'default',
            'Pragma': forzarRecarga ? 'no-cache' : 'default',
            'Expires': forzarRecarga ? '0' : 'default'
        },
        cache: forzarRecarga ? 'no-store' : 'default'
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.channels || [];
};

// Función para decodificar URLs base64
const decodeBase64Url = (encodedUrl) => {
    try {
        return atob(encodedUrl);
    } catch (error) {
        console.error('Error decoding base64:', error);
        return encodedUrl;
    }
};

// Función helper para verificar si una URL es válida para streaming
const isValidStreamUrl = (url) => {
    if (!url || typeof url !== 'string') return false;

    // Verificar que sea una URL válida
    try {
        new URL(url);
    } catch {
        return false;
    }

    // Verificar patrones de streaming comunes
    const streamIndicators = [
        '.m3u8',
        '.mpd',
        'live',
        'stream',
        'hls',
        'dash',
        'playlist',
        'manifest'
    ];

    const lowerUrl = url.toLowerCase();
    return streamIndicators.some(indicator => lowerUrl.includes(indicator)) ||
        // O si es de dominios conocidos de streaming
        /(?:twitch\.tv|youtube\.com|vimeo\.com|dailymotion\.com)/i.test(url);
};

// Helper function to load channel data
const loadChannelData = async (forzarRecarga = false) => {
    try {
        if (forzarRecarga) {
            console.log('🔄 FORZANDO carga de canales...');
        } else {
            console.log('🔄 Cargando canales...');
        }
        const canales = await obtenerCanalesRereyano(forzarRecarga);
        console.log('✅ Canales cargados:', canales.length);
        return canales;
    } catch (error) {
        console.error('❌ Error loading channels:', error);

        // Fallback: intentar cargar desde archivo local
        try {
            console.log('🔄 Intentando fallback con archivo local...');
            const timestamp = new Date().getTime();
            const response = await fetch(`/channelData.json?t=${timestamp}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                },
                cache: 'no-store'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('✅ Fallback exitoso - canales desde archivo local:', data.channels?.length || 0);
            return data.channels || [];
        } catch (fallbackError) {
            console.error('❌ Error en fallback también:', fallbackError);
            throw new Error('No se pudieron cargar los canales');
        }
    }
};

const ExploreChannels = () => {
    const navigate = useNavigate();
    const [channels, setChannels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [filteredChannels, setFilteredChannels] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                setError(null);
                console.log('🎯 Componente ExploreChannels montado - Cargando datos');

                const channelData = await loadChannelData(true);

                console.log('📺 Channels loaded:', channelData.length);

                setChannels(channelData);
                setFilteredChannels(channelData);

            } catch (err) {
                console.error('Error fetching data:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Detectar cuando la ventana se enfoca de nuevo y recargar datos
    useEffect(() => {
        const handleFocus = () => {
            console.log('🔄 Ventana enfocada, recargando datos...');
            const fetchData = async () => {
                try {
                    const channelData = await loadChannelData(true);
                    setChannels(channelData);
                    setFilteredChannels(channelData);
                } catch (err) {
                    console.error('Error al recargar datos:', err);
                }
            };
            fetchData();
        };

        window.addEventListener('focus', handleFocus);

        return () => {
            window.removeEventListener('focus', handleFocus);
        };
    }, []);

    // useEffect para filtrar canales cuando cambia el término de búsqueda
    useEffect(() => {
        console.log('🔍 Filtro de búsqueda activado:', {
            searchTerm,
            channelsCount: channels.length,
            hasSearchTerm: !!searchTerm.trim()
        });

        if (!searchTerm.trim()) {
            setFilteredChannels(channels);
        } else {
            const filtered = channels.filter(channel => {
                const channelName = (channel.name || '').toLowerCase();
                const channelId = (channel.id || '').toLowerCase();
                const search = searchTerm.toLowerCase().trim();

                // Buscar en nombre, ID y también normalizar caracteres especiales
                const normalizedName = channelName
                    .replace(/[áàäâ]/g, 'a')
                    .replace(/[éèëê]/g, 'e')
                    .replace(/[íìïî]/g, 'i')
                    .replace(/[óòöô]/g, 'o')
                    .replace(/[úùüû]/g, 'u')
                    .replace(/[ñ]/g, 'n');

                const normalizedSearch = search
                    .replace(/[áàäâ]/g, 'a')
                    .replace(/[éèëê]/g, 'e')
                    .replace(/[íìïî]/g, 'i')
                    .replace(/[óòöô]/g, 'o')
                    .replace(/[úùüû]/g, 'u')
                    .replace(/[ñ]/g, 'n');

                const matches = normalizedName.includes(normalizedSearch) ||
                    channelId.includes(search) ||
                    channelName.includes(search);

                if (matches) {
                    console.log('✅ Canal coincide:', channel.name, 'con búsqueda:', search);
                }

                return matches;
            });

            console.log('🎯 Resultados filtrados:', filtered.length);
            setFilteredChannels(filtered);
        }
    }, [searchTerm, channels]);

    // Función para agrupar canales por nombres similares
    const groupChannelsByName = (channels) => {
        const groups = {};

        channels.forEach(channel => {
            const name = channel.name || `Canal ${channel.id}`;
            const cleanName = name.toLowerCase().trim();

            // Buscar patrones comunes
            let groupKey = null;

            // Patrones de prefijos comunes y específicos
            const specificPatterns = [
                { pattern: 'dazn', group: 'DAZN' },
                { pattern: 'laliga', group: 'LALIGA' },
                { pattern: 'la liga', group: 'LALIGA' },
                { pattern: 'espn', group: 'ESPN' },
                { pattern: 'fox', group: 'FOX SPORTS' },
                { pattern: 'hbo', group: 'HBO' },
                { pattern: 'cnn', group: 'CNN' },
                { pattern: 'bbc', group: 'BBC' },
                { pattern: 'mtv', group: 'MTV' },
                { pattern: 'vh1', group: 'VH1' },
                { pattern: 'nick', group: 'NICKELODEON' },
                { pattern: 'disc', group: 'DISCOVERY' },
                { pattern: 'hist', group: 'HISTORY' },
                { pattern: 'natg', group: 'NAT GEO' },
                { pattern: 'anim', group: 'ANIMAL PLANET' },
                { pattern: 'tyc', group: 'TYC SPORTS' },
                { pattern: 'dsports', group: 'DSPORTS' },
                { pattern: 'claro', group: 'CLARO' }
            ];

            for (const { pattern, group } of specificPatterns) {
                if (cleanName.includes(pattern)) {
                    groupKey = group;
                    break;
                }
            }

            // Si no encontró un patrón específico, usar las primeras 3 letras como grupo
            if (!groupKey) {
                const words = cleanName.split(/[\s\-_]+/);
                const firstWord = words[0];

                if (firstWord.length >= 3) {
                    // Buscar otros canales que empiecen similar
                    const similar = channels.filter(c => {
                        const otherName = (c.name || `Canal ${c.id}`).toLowerCase().trim();
                        const otherWords = otherName.split(/[\s\-_]+/);
                        const otherFirstWord = otherWords[0];

                        return otherFirstWord.length >= 3 &&
                            (otherFirstWord.startsWith(firstWord.substring(0, 3)) ||
                                firstWord.startsWith(otherFirstWord.substring(0, 3)));
                    });

                    if (similar.length > 1) {
                        groupKey = firstWord.substring(0, 3).toUpperCase();
                    }
                }
            }

            // Si aún no tiene grupo, buscar patrones de sufijos
            if (!groupKey) {
                const suffixPatterns = ['hd', 'plus', 'max', 'premium', 'sport', 'news', 'kids'];
                for (const pattern of suffixPatterns) {
                    if (cleanName.includes(pattern)) {
                        groupKey = pattern.toUpperCase();
                        break;
                    }
                }
            }

            // Si no encontró grupo, usar "OTROS"
            if (!groupKey) {
                groupKey = 'OTROS';
            }

            if (!groups[groupKey]) {
                groups[groupKey] = [];
            }
            groups[groupKey].push(channel);
        });

        // Ordenar grupos y canales dentro de cada grupo
        const sortedGroups = {};
        Object.keys(groups)
            .sort((a, b) => {
                // Poner "OTROS" al final
                if (a === 'OTROS') return 1;
                if (b === 'OTROS') return -1;
                return a.localeCompare(b);
            })
            .forEach(key => {
                sortedGroups[key] = groups[key].sort((a, b) => {
                    const nameA = (a.name || `Canal ${a.id}`).toLowerCase();
                    const nameB = (b.name || `Canal ${b.id}`).toLowerCase();
                    return nameA.localeCompare(nameB);
                });
            });

        return sortedGroups;
    };

    const openChannel = (channel) => {
        if (!channel.iframeUrl) {
            console.error('No iframe URL found for channel:', channel);
            return;
        }

        try {
            console.log('Opening channel:', channel.name);
            const channelData = encodeURIComponent(JSON.stringify(channel));
            const playerUrl = `/channel-player/${channel.id}?channelData=${channelData}`;

            // Navegar a la página del reproductor en lugar de abrir popup
            navigate(playerUrl);
        } catch (error) {
            console.error('Error opening channel:', error);
            alert('Error al abrir el canal. Inténtalo de nuevo.');
        }
    };

    const retryFetch = async () => {
        try {
            setLoading(true);
            setError(null);
            console.log('🔄 Reintentando carga de canales...');
            const channelData = await loadChannelData(true); // Forzar recarga en reintentos
            setChannels(channelData);
            setFilteredChannels(channelData);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const clearSearch = () => {
        setSearchTerm("");
        // No es necesario setFilteredChannels aquí porque useEffect se encarga
    };

    const getChannelCategory = (channel) => {
        if (!channel.name) return "General";

        const name = channel.name.toLowerCase();
        if (name.includes("sport") || name.includes("deportes") || name.includes("tyc") || name.includes("espn")) {
            return "Deportes";
        }
        if (name.includes("news") || name.includes("noticias") || name.includes("tn") || name.includes("c5n")) {
            return "Noticias";
        }
        if (name.includes("cine") || name.includes("movie") || name.includes("film")) {
            return "Cine";
        }
        if (name.includes("kids") || name.includes("niños") || name.includes("disney") || name.includes("cartoon")) {
            return "Infantil";
        }
        if (name.includes("music") || name.includes("música") || name.includes("mtv")) {
            return "Música";
        }
        return "General";
    };

    if (loading) {
        return (
            <div className="exploreChannelsPage">
                <div className="pageHeader">
                    <div className="pageTitle">                        <h1>
                        <span className="title-icon">📺</span>
                        Canales de TV
                    </h1>
                        <p>Cargando canales...</p>
                    </div>
                </div>
                <div className="loadingContainer">
                    <div className="loadingSpinner"></div>
                    <p>
                        <svg className="loading-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" fill="currentColor" />
                        </svg>
                        Cargando lista de canales...
                    </p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="exploreChannelsPage">
                <div className="pageHeader">                    <div className="pageTitle">                        <h1>
                    <svg className="page-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <g>
                            <path fillRule="evenodd" clipRule="evenodd" d="M16 6H13.4163H10.5837H8C5.17157 6 3.75736 6 2.87868 6.87868C2 7.75736 2 9.17157 2 12V16C2 18.8284 2 20.2426 2.87868 21.1213C3.75736 22 5.17157 22 8 22L16 22V6Z" fill="#1C274C" />
                            <path opacity="0.5" d="M22 11.9998V15.9998C22 18.8282 22 20.2424 21.1213 21.1211C20.296 21.9464 18.9983 21.9966 16.5 21.9996H16V6H16.5C18.9983 6.00305 20.296 6.05318 21.1213 6.87848C22 7.75716 22 9.17138 22 11.9998Z" fill="#1C274C" />
                            <path opacity="0.5" d="M13.4163 6.00011L15.5695 3.48811C15.839 3.17361 15.8026 2.70014 15.4881 2.43057C15.1736 2.161 14.7001 2.19743 14.4306 2.51192L12 5.34757L9.56946 2.51192C9.29989 2.19743 8.82641 2.16101 8.51192 2.43057C8.19743 2.70014 8.161 3.17361 8.43057 3.48811L10.5837 6.00011H13.4163Z" fill="#1C274C" />
                            <path d="M19 11C19.5523 11 20 11.4477 20 12C20 12.5523 19.5523 13 19 13C18.4477 13 18 12.5523 18 12C18 11.4477 18.4477 11 19 11Z" fill="#1C274C" />
                            <path d="M19 15C19.5523 15 20 15.4477 20 16C20 16.5523 19.5523 17 19 17C18.4477 17 18 16.5523 18 16C18 15.4477 18.4477 15 19 15Z" fill="#1C274C" />
                        </g>
                    </svg>
                    Canales de TV
                </h1>
                    <p>Error al cargar canales</p>
                </div>
                </div>
                <div className="errorContainer">
                    <div className="errorMessage">
                        <h3>
                            <svg className="error-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor" />
                            </svg>
                            Error al cargar los canales
                        </h3>
                        <p>{error}</p>                        <button onClick={retryFetch} className="retryButton">
                            <svg className="retry-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" fill="currentColor" />
                            </svg>
                            Intentar nuevamente
                        </button>
                    </div>
                </div>
            </div>
        );
    }    return (
        <div className="exploreChannelsPage">
            {/* Componente flotante independiente */}
            <FloatingBackToTopButton />

            {/* Agenda deportiva arriba */}
            <div className="sportsContainer">
                <SportsAgenda />
            </div>

            {/* Separador */}            <div className="sectionSeparator">                <h2>
                Canales de TV
            </h2>
                <p>{filteredChannels.length} canales disponibles</p>
            </div>

            {/* Buscador de canales */}
            <div className="searchSection">
                <div className="searchContainer">                    <input
                    type="text"
                    placeholder="Buscar canales..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)} className="searchInput"
                />
                    <svg className="search-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path opacity="0.1" d="M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" fill="#323232" />
                        <path d="M15 15L21 21" stroke="#323232" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="#323232" strokeWidth="2" />
                    </svg>
                    {searchTerm && (
                        <button
                            onClick={clearSearch}
                            className="clearButton"
                            title="Limpiar búsqueda"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            {/* Canales abajo */}
            <div className="channelsContainer">
                {filteredChannels.length === 0 ? (
                    <div className="emptyState">
                        {searchTerm ? (
                            <>                                <h3>
                                <svg className="search-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path opacity="0.1" d="M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" fill="#323232" />                                        <path d="M15 15L21 21" stroke="#323232" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="#323232" strokeWidth="2" />
                                </svg>
                                Sin resultados para "{searchTerm}"
                            </h3>
                                <p>Intenta con otros términos de búsqueda</p>
                                <button onClick={clearSearch} className="clearSearchButton">
                                    Limpiar búsqueda
                                </button>
                            </>
                        ) : (
                            <>                                <h3>
                                <svg className="tv-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <g>
                                        <path fillRule="evenodd" clipRule="evenodd" d="M16 6H13.4163H10.5837H8C5.17157 6 3.75736 6 2.87868 6.87868C2 7.75736 2 9.17157 2 12V16C2 18.8284 2 20.2426 2.87868 21.1213C3.75736 22 5.17157 22 8 22L16 22V6Z" fill="#1C274C" />
                                        <path opacity="0.5" d="M22 11.9998V15.9998C22 18.8282 22 20.2424 21.1213 21.1211C20.296 21.9464 18.9983 21.9966 16.5 21.9996H16V6H16.5C18.9983 6.00305 20.296 6.05318 21.1213 6.87848C22 7.75716 22 9.17138 22 11.9998Z" fill="#1C274C" />
                                        <path opacity="0.5" d="M13.4163 6.00011L15.5695 3.48811C15.839 3.17361 15.8026 2.70014 15.4881 2.43057C15.1736 2.161 14.7001 2.19743 14.4306 2.51192L12 5.34757L9.56946 2.51192C9.29989 2.19743 8.82641 2.16101 8.51192 2.43057C8.19743 2.70014 8.161 3.17361 8.43057 3.48811L10.5837 6.00011H13.4163Z" fill="#1C274C" />
                                        <path d="M19 11C19.5523 11 20 11.4477 20 12C20 12.5523 19.5523 13 19 13C18.4477 13 18 12.5523 18 12C18 11.4477 18.4477 11 19 11Z" fill="#1C274C" />
                                        <path d="M19 15C19.5523 15 20 15.4477 20 16C20 16.5523 19.5523 17 19 17C18.4477 17 18 16.5523 18 16C18 15.4477 18.4477 15 19 15Z" fill="#1C274C" />
                                    </g>
                                </svg>
                                No hay canales disponibles
                            </h3>
                                <p>No se encontraron canales para mostrar</p>                                <button onClick={retryFetch} className="retryButton">
                                    <svg className="retry-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" fill="currentColor" />
                                    </svg>
                                    Reintentar carga
                                </button>
                            </>
                        )}
                    </div>) : (
                    <div className="channelGrid">
                        {/* Grid continuo con todos los canales ordenados por tipo y nombre */}
                        {(() => {
                            const groupedChannels = groupChannelsByName(filteredChannels);

                            // Crear array plano manteniendo el orden de grupos y sus canales
                            const sortedChannels = Object.entries(groupedChannels)
                                .sort(([groupA], [groupB]) => {
                                    // Poner "OTROS" al final
                                    if (groupA === 'OTROS') return 1;
                                    if (groupB === 'OTROS') return -1;
                                    return groupA.localeCompare(groupB);
                                })
                                .flatMap(([groupName, groupChannels]) => groupChannels);

                            return sortedChannels.map((channel, index) => (
                                <div
                                    key={`${channel.id || channel.name || index}`}
                                    className="channelCard"
                                    onClick={() => openChannel(channel)}
                                >                                    <ChannelImage 
                                        channel={channel}
                                        index={index}
                                    />
                                    <div className="channelInfo">
                                        <h3 className="channelName">
                                            {(channel.name || `Canal ${index + 1}`)}
                                        </h3>
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>                )}
            </div>
        </div>
    );
};

export default ExploreChannels;
