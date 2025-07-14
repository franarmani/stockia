import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './SportsAgenda.scss';

const SportsAgenda = () => {
    const navigate = useNavigate();
    const [events, setEvents] = useState([]);
    const [channelData, setChannelData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);    const [selectedDate, setSelectedDate] = useState('todos');
    const [selectedSport, setSelectedSport] = useState('todos');
    const [argentineDateTime, setArgentineDateTime] = useState(null);
    const [isAgendaVisible, setIsAgendaVisible] = useState(true); // Para mostrar/ocultar toda la agenda

    useEffect(() => {
        loadArgentineDateTime();
        loadSportsEvents();
        loadChannelData();
    }, []);

    useEffect(() => {
        // Actualizar la hora cada minuto
        const interval = setInterval(() => {
            const now = new Date();
            const argentineTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
            setArgentineDateTime(argentineTime);
        }, 60000);

        return () => clearInterval(interval);
    }, []);

    const loadArgentineDateTime = async () => {
        try {
            const response = await fetch('https://worldtimeapi.org/api/timezone/America/Argentina/Buenos_Aires');
            if (response.ok) {
                const data = await response.json();
                const argentineTime = new Date(data.datetime);
                setArgentineDateTime(argentineTime);
            } else {
                throw new Error('API no disponible');
            }
        } catch (error) {
            console.log('Usando zona horaria del navegador para Argentina');
            const now = new Date();
            const argentineTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
            setArgentineDateTime(argentineTime);
        }
    };    const loadSportsEvents = async () => {
        try {
            setLoading(true);
            const response = await fetch('https://agenda-backend-gtmv.onrender.com/api/agenda');

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            console.log('Datos cargados:', data); // Debug
            
            // Verificar si data es un array o tiene una propiedad que contenga el array
            let eventsArray = [];
            if (Array.isArray(data)) {
                eventsArray = data;
            } else if (data && Array.isArray(data.events)) {
                eventsArray = data.events;
            } else if (data && Array.isArray(data.events2)) {
                eventsArray = data.events2;
            } else {
                throw new Error('Los datos no contienen un array válido de eventos');
            }
              // Enriquecer eventos con datos adicionales
            const enrichedEvents = enrichEventsWithFlags(eventsArray);
            console.log('📊 Eventos con canales:', enrichedEvents.filter(e => e.channels?.length > 0).length);
            console.log('📺 Ejemplos de canales encontrados:', 
                enrichedEvents
                    .filter(e => e.channels?.length > 0)
                    .slice(0, 3)
                    .map(e => ({ name: e.name, channels: e.channels }))
            );
            setEvents(enrichedEvents);
            setError(null);
        } catch (error) {
            setError(`Error al cargar eventos deportivos: ${error.message}`);
            console.error('Error loading sports events:', error);
        } finally {
            setLoading(false);
        }
    };    const loadChannelData = async () => {
        try {
            console.log('🔄 Cargando datos de canales...');
            const response = await fetch('/channelData.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log('✅ Datos de canales cargados:', {
                totalChannels: data.channels?.length || 0,
                sampleChannels: data.channels?.slice(0, 3).map(ch => ({ id: ch.id, name: ch.name })) || []
            });
            setChannelData(data);
        } catch (error) {
            console.error('❌ Error loading channel data:', error);
        }
    };    const getServersForEvent = (event) => {
        if (!channelData || !event.channels) {
            console.log('❌ No hay channelData o channels en el evento:', { channelData: !!channelData, eventChannels: event.channels });
            return [];
        }

        const servers = [];
        console.log('🔍 Buscando servidores para canales:', event.channels);
        
        event.channels.forEach(channelName => {
            console.log(`🔍 Buscando canal: "${channelName}"`);
            
            // Buscar TODOS los canales que coincidan con cualquier palabra del nombre
            const matchingChannels = findAllMatchingChannels(channelName);
            
            if (matchingChannels.length > 0) {
                console.log(`✅ ${matchingChannels.length} canales encontrados para "${channelName}":`, 
                    matchingChannels.map(ch => ch.name || ch.id));
                
                matchingChannels.forEach(channelInfo => {
                    if (channelInfo.iframeUrl) {
                        servers.push({
                            name: channelInfo.name || channelName,
                            url: channelInfo.iframeUrl,
                            quality: 'HD',
                            status: 'online',
                            channelData: channelInfo // Datos completos del canal para abrir en player
                        });
                    }
                });
            } else {
                console.log('❌ No se encontraron canales para:', channelName);
                // Crear un servidor placeholder para canales no encontrados
                servers.push({
                    name: channelName,
                    url: '#',
                    quality: 'HD',
                    status: 'offline',
                    channelData: null
                });
            }
        });

        console.log('📺 Total servidores encontrados:', servers.length);
        return servers;
    };    const findAllMatchingChannels = (channelName) => {
        if (!channelData || !channelName) return [];

        const channelNameLower = channelName.toLowerCase().trim();
        const searchWords = channelNameLower.split(/\s+/); // Dividir en palabras
        
        console.log(`🔍 FILTRADO ESTRICTO: Buscando canales para "${channelName}" (palabras: ${searchWords.join(', ')})`);

        const matchingChannels = channelData.channels.filter(channel => {
            const chName = (channel.name || '').toLowerCase().trim();
            const chId = (channel.id || '').toLowerCase().trim();

            // 1. Coincidencia exacta (máxima prioridad)
            if (chName === channelNameLower || chId === channelNameLower) {
                console.log(`🎯 EXACTA: "${channel.name}" para "${channelName}"`);
                return true;
            }

            // 2. Mapeo específico y ESTRICTO para eventos deportivos
            const strictEventMapping = {
                // ESPN - Solo canales ESPN específicos
                'espn': () => {
                    return (chName.includes('espn') || chId.includes('espn')) && 
                           !chName.includes('fox') && !chName.includes('star') && !chName.includes('warner');
                },
                'espn 1': () => chName.includes('espn') && (chName === 'espn' || chName === 'espn 1' || chName === 'espn1'),
                'espn 2': () => chName.includes('espn') && (chName.includes('2') || chName === 'espn 2' || chName === 'espn2'),
                'espn 3': () => chName.includes('espn') && (chName.includes('3') || chName === 'espn 3' || chName === 'espn3'),
                'espn premium': () => chName.includes('espn') && chName.includes('premium'),
                'espn deportes': () => chName.includes('espn') && chName.includes('deportes'),
                
                // FOX SPORTS - Solo canales Fox Sports
                'fox sports': () => chName.includes('fox') && chName.includes('sport') && !chName.includes('espn'),
                'fox sports 1': () => chName.includes('fox') && chName.includes('sport') && (chName.includes('1') || chName === 'fox sports'),
                'fox sports 2': () => chName.includes('fox') && chName.includes('sport') && chName.includes('2'),
                'fox sports 3': () => chName.includes('fox') && chName.includes('sport') && chName.includes('3'),
                'fox': () => chName.includes('fox') && !chName.includes('espn') && !chName.includes('cnn'),
                
                // DSPORTS - Solo canales DSports
                'dsports': () => (chName.includes('dsports') || chId.includes('dsports')) && !chName.includes('espn') && !chName.includes('fox'),
                'dsports +': () => chName.includes('dsports') && (chName.includes('+') || chName.includes('plus')),
                'dsports plus': () => chName.includes('dsports') && chName.includes('plus'),
                
                // DAZN - Solo canales DAZN específicos
                'dazn': () => {
                    return (chName.includes('dazn') || chId.includes('dazn')) && 
                           !chName.includes('espn') && !chName.includes('fox') && !chName.includes('bein');
                },
                'dazn 1': () => chName.includes('dazn') && (chName.includes('1') || chName.includes('liga') || chName === 'dazn'),
                'dazn 2': () => chName.includes('dazn') && chName.includes('2'),
                'dazn f1': () => chName.includes('dazn') && chName.includes('f1'),
                'dazn liga': () => chName.includes('dazn') && (chName.includes('liga') || chName.includes('laliga')),
                
                // TYC SPORTS - Solo canales TYC
                'tyc': () => (chName.includes('tyc') || chId.includes('tyc')) && !chName.includes('espn'),
                'tyc sports': () => chName.includes('tyc') && chName.includes('sport'),
                'tyc sports 2': () => chName.includes('tyc') && chName.includes('sport') && chName.includes('2'),
                
                // BEIN SPORTS - Solo canales BeIN
                'bein': () => (chName.includes('bein') || chId.includes('bein')) && !chName.includes('espn'),
                'bein sports': () => chName.includes('bein') && chName.includes('sport'),
                'bein sports 1': () => chName.includes('bein') && chName.includes('sport') && (chName.includes('1') || chName === 'bein sports'),
                'bein sports 2': () => chName.includes('bein') && chName.includes('sport') && chName.includes('2'),
                
                // TNT - Solo canales TNT específicos
                'tnt': () => (chName.includes('tnt') || chId.includes('tnt')) && !chName.includes('espn'),
                'tnt sports': () => chName.includes('tnt') && chName.includes('sport'),
                'tnt hd': () => chName.includes('tnt') && !chName.includes('sport'),
                
                // DISNEY - Solo canales Disney
                'disney +': () => chName.includes('disney') && !chName.includes('espn') && !chName.includes('fox'),
                'disney plus': () => chName.includes('disney') && !chName.includes('espn') && !chName.includes('fox'),
                'disney': () => chName.includes('disney') && !chName.includes('espn') && !chName.includes('fox'),
                
                // Canales específicos de países
                'gol peru': () => chName.includes('gol') && chName.includes('peru'),
                'golperu': () => chName.includes('golperu') || (chName.includes('gol') && chName.includes('peru')),
                'claro sports': () => chName.includes('claro') && chName.includes('sport'),
                'tudn': () => chName.includes('tudn') || chId.includes('tudn'),
                'tudn usa': () => chName.includes('tudn'),
                
                // Canales europeos específicos
                'ligue 1 fr': () => (chName.includes('ligue') && chName.includes('1') && chName.includes('fr')) || 
                                    (chName.includes('ligue1') && chName.includes('fr')),
                'ligue 1': () => chName.includes('ligue') && chName.includes('1'),
                'extra sport1': () => chName.includes('extra') && chName.includes('sport') && chName.includes('1'),
                'extra sport2': () => chName.includes('extra') && chName.includes('sport') && chName.includes('2'),
                'extra sport3': () => chName.includes('extra') && chName.includes('sport') && chName.includes('3'),
                'extra sport6': () => chName.includes('extra') && chName.includes('sport') && chName.includes('6'),
                'extra sport': () => chName.includes('extra') && chName.includes('sport'),
                
                // Movistar/M+ - Solo estos canales
                'es m+ deportes': () => {
                    return (chName.includes('m+') && chName.includes('deportes')) ||
                           (chName.includes('movistar') && chName.includes('deportes')) ||
                           (chName.includes('es') && chName.includes('m+') && chName.includes('sport'));
                },
                'm+ deportes': () => chName.includes('m+') && chName.includes('deportes'),
                'movistar deportes': () => chName.includes('movistar') && chName.includes('deportes'),
                
                // Canales argentinos específicos
                'telefe': () => chName.includes('telefe') || chId.includes('telefe'),
                'tv publica': () => (chName.includes('tv') && chName.includes('publica')) || chName.includes('canal7'),
                'canal 7': () => chName.includes('canal') && chName.includes('7'),
                
                // NBA TV específico
                'nba tv': () => chName.includes('nba') && chName.includes('tv'),
                
                // Términos genéricos - SOLO si son muy específicos
                'futbol': () => false, // Demasiado genérico, no devolver nada
                'football': () => false, // Demasiado genérico, no devolver nada
                'sport': () => false, // Demasiado genérico, no devolver nada
                'sports': () => false, // Demasiado genérico, no devolver nada
                'por confirmar': () => false, // No hay canal
            };

            // Aplicar mapeo estricto
            if (strictEventMapping[channelNameLower]) {
                const matches = strictEventMapping[channelNameLower]();
                if (matches) {
                    console.log(`🎯 MAPEO ESTRICTO: "${channel.name}" para "${channelName}"`);
                    return true;
                }
                // Si hay mapeo específico pero no coincide, NO continuar con otros filtros
                console.log(`❌ MAPEO ESTRICTO RECHAZADO: "${channel.name}" para "${channelName}"`);
                return false;
            }

            // 3. Para canales sin mapeo específico, usar coincidencia exacta de palabras clave
            // SOLO si todas las palabras clave coinciden
            if (searchWords.length >= 2) {
                const allWordsMatch = searchWords.every(word => {
                    if (word.length < 3) return true; // Ignorar palabras muy cortas
                    return chName.includes(word) || chId.includes(word);
                });
                
                if (allWordsMatch) {
                    // Verificar que no sea un falso positivo
                    const isFalsePositive = searchWords.some(word => {
                        return word === 'sport' || word === 'sports' || word === 'tv' || 
                               word === 'hd' || word === 'plus' || word === '+';
                    });
                    
                    if (!isFalsePositive) {
                        console.log(`🎯 COINCIDENCIA EXACTA DE PALABRAS: "${channel.name}" para "${channelName}"`);
                        return true;
                    }
                }
            }

            // 4. Para canales de una sola palabra, debe ser coincidencia muy específica
            if (searchWords.length === 1) {
                const singleWord = searchWords[0];
                if (singleWord.length >= 4) { // Mínimo 4 caracteres
                    if (chName === singleWord || chId === singleWord || 
                        chName.startsWith(singleWord + ' ') || chName.endsWith(' ' + singleWord)) {
                        console.log(`🎯 COINCIDENCIA ESPECÍFICA PALABRA ÚNICA: "${channel.name}" para "${channelName}"`);
                        return true;
                    }
                }
            }

            // NO permitir coincidencias parciales o genéricas
            return false;
        });        // Ordenar por relevancia: coincidencias exactas primero, luego por especificidad
        matchingChannels.sort((a, b) => {
            const aName = (a.name || '').toLowerCase();
            const bName = (b.name || '').toLowerCase();
            
            // Coincidencia exacta tiene máxima prioridad
            const aExact = aName === channelNameLower || (a.id || '').toLowerCase() === channelNameLower;
            const bExact = bName === channelNameLower || (b.id || '').toLowerCase() === channelNameLower;
            
            if (aExact && !bExact) return -1;
            if (!aExact && bExact) return 1;
            
            // Priorizar canales que contienen todas las palabras del nombre del evento
            const aContainsAllWords = searchWords.every(word => word.length < 3 || aName.includes(word));
            const bContainsAllWords = searchWords.every(word => word.length < 3 || bName.includes(word));
            
            if (aContainsAllWords && !bContainsAllWords) return -1;
            if (!aContainsAllWords && bContainsAllWords) return 1;
            
            // Priorizar canales con nombres más cortos (más específicos)
            if (aName.length !== bName.length) {
                return aName.length - bName.length;
            }
            
            // Luego por nombre alfabético
            return aName.localeCompare(bName);
        });

        if (matchingChannels.length > 0) {
            console.log(`✅ FILTRADO ESTRICTO COMPLETADO: ${matchingChannels.length} canales para "${channelName}"`);
            matchingChannels.forEach((ch, idx) => {
                console.log(`   ${idx + 1}. ${ch.name || ch.id}`);
            });
        } else {
            console.log(`❌ FILTRADO ESTRICTO: No se encontraron canales específicos para "${channelName}"`);
        }
        
        return matchingChannels;
    };

    const findChannelByName = (channelName) => {
        // Mantener la función original para compatibilidad
        const matches = findAllMatchingChannels(channelName);
        return matches.length > 0 ? matches[0] : null;
    };

    const openChannelPlayer = (server) => {
        if (!server.channelData || !server.channelData.iframeUrl) {
            console.error('No hay datos válidos del canal:', server);
            return;
        }

        try {
            console.log('Abriendo canal en player:', server.channelData.name);
            const channelData = encodeURIComponent(JSON.stringify(server.channelData));
            const playerUrl = `/channel-player/${server.channelData.id}?channelData=${channelData}`;
            
            // Navegar a la página del reproductor
            navigate(playerUrl);
        } catch (error) {
            console.error('Error abriendo canal:', error);
            alert('Error al abrir el canal. Inténtalo de nuevo.');
        }
    };

    const openEventInPlayer = (event) => {
        const availableServers = getServersForEvent(event);
        
        if (availableServers.length === 0) {
            alert('No hay servidores disponibles para este evento.');
            return;
        }

        // Filtrar solo servidores online
        const onlineServers = availableServers.filter(server => 
            server.status === 'online' && server.channelData && server.channelData.iframeUrl
        );

        if (onlineServers.length === 0) {
            alert('No hay servidores online disponibles para este evento.');
            return;
        }

        try {
            // Crear datos del evento para el reproductor
            const eventData = {
                id: event.id,
                name: event.teams && event.teams.length >= 2 
                    ? `${event.teams[0]} vs ${event.teams[1]}`
                    : event.name,
                sport: event.sport,
                time: event.time,
                date: event.date,
                description: event.description,
                servers: onlineServers.map(server => ({
                    id: server.channelData.id,
                    name: server.name,
                    quality: server.quality,
                    channelData: server.channelData
                }))
            };

            console.log('Abriendo evento en player:', eventData.name, 'con', eventData.servers.length, 'opciones');
            
            // Usar el primer servidor como predeterminado y pasar todos los servidores como opciones
            const defaultServer = onlineServers[0];
            const channelData = encodeURIComponent(JSON.stringify(defaultServer.channelData));
            const eventInfo = encodeURIComponent(JSON.stringify(eventData));
            
            const playerUrl = `/channel-player/${defaultServer.channelData.id}?channelData=${channelData}&eventData=${eventInfo}`;
            
            // Navegar a la página del reproductor
            navigate(playerUrl);        } catch (error) {
            console.error('Error abriendo evento:', error);
            alert('Error al abrir el evento. Inténtalo de nuevo.');
        }
    };

    const getAvailableDates = () => {
        const dates = [...new Set(events.map(event => event.date))];
        return dates.sort();
    };

    const getAvailableSports = () => {
        const sports = [...new Set(events.map(event => event.sport))];
        return sports.sort();
    };

    const getTimeUntilEvent = (eventDate, eventTime) => {
        if (!argentineDateTime) return '';

        try {
            const eventDateTime = new Date(`${eventDate}T${eventTime}:00`);
            const now = argentineDateTime;
            const timeDiff = eventDateTime - now;

            if (timeDiff < 0) {
                const absTimeDiff = Math.abs(timeDiff);
                const hours = Math.floor(absTimeDiff / (1000 * 60 * 60));
                const minutes = Math.floor((absTimeDiff % (1000 * 60 * 60)) / (1000 * 60));
                
                if (hours < 2) {
                    return '🔴 En vivo';
                } else {
                    return '⚫ Finalizado';
                }
            } else {
                const hours = Math.floor(timeDiff / (1000 * 60 * 60));
                const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
                
                if (hours > 0) {
                    return `⏰ En ${hours}h ${minutes}m`;
                } else {
                    return `⏰ En ${minutes}m`;
                }
            }
        } catch (error) {
            return '';
        }
    };

    const getCountryFlag = (countryCode) => {
        return `https://flagsapi.com/${countryCode.toUpperCase()}/flat/32.png`;
    };    // Función para enriquecer eventos con banderas de países
    const enrichEventsWithFlags = (events) => {
        // Verificar que events sea un array válido
        if (!Array.isArray(events)) {
            console.error('enrichEventsWithFlags: events no es un array válido', events);
            return [];
        }

        // Mapa de equipos que son selecciones nacionales
        const nationalTeams = {
            'argentina': 'AR',
            'brasil': 'BR',
            'brazil': 'BR',
            'uruguay': 'UY',
            'chile': 'CL',
            'colombia': 'CO',
            'peru': 'PE',
            'ecuador': 'EC',
            'bolivia': 'BO',
            'paraguay': 'PY',
            'venezuela': 'VE',
            'españa': 'ES',
            'spain': 'ES',
            'francia': 'FR',
            'france': 'FR',
            'alemania': 'DE',
            'germany': 'DE',
            'italia': 'IT',
            'italy': 'IT',
            'inglaterra': 'GB',
            'england': 'GB',
            'portugal': 'PT',
            'holanda': 'NL',
            'netherlands': 'NL',
            'belgica': 'BE',
            'belgium': 'BE',
            'croacia': 'HR',
            'croatia': 'HR',
            'serbia': 'RS',
            'suiza': 'CH',
            'switzerland': 'CH',
            'austria': 'AT',
            'dinamarca': 'DK',
            'denmark': 'DK',
            'suecia': 'SE',
            'sweden': 'SE',
            'noruega': 'NO',
            'norway': 'NO',
            'polonia': 'PL',
            'poland': 'PL',
            'republica checa': 'CZ',
            'czech republic': 'CZ',
            'hungria': 'HU',
            'hungary': 'HU',
            'eslovaquia': 'SK',
            'slovakia': 'SK',
            'ucrania': 'UA',
            'ukraine': 'UA',
            'rusia': 'RU',
            'russia': 'RU',
            'mexico': 'MX',
            'usa': 'US',
            'estados unidos': 'US',
            'united states': 'US',
            'canada': 'CA',
            'japon': 'JP',
            'japan': 'JP',
            'corea del sur': 'KR',
            'south korea': 'KR',
            'australia': 'AU',
            'marruecos': 'MA',
            'morocco': 'MA',
            'tunez': 'TN',
            'tunisia': 'TN',
            'argelia': 'DZ',
            'algeria': 'DZ',
            'egipto': 'EG',
            'egypt': 'EG',
            'sudafrica': 'ZA',
            'south africa': 'ZA',
            'nigeria': 'NG',
            'ghana': 'GH',
            'senegal': 'SN',
            'camerun': 'CM',
            'cameroon': 'CM',
            'costa de marfil': 'CI',
            'ivory coast': 'CI'
        };

        return events.map(event => {
            const enrichedEvent = { ...event };

            // Solo procesar eventos que tienen equipos
            if (!event.teams || event.teams.length < 2) return enrichedEvent;

            const nationalTeamCountries = [];

            event.teams.forEach((team, index) => {
                const teamLower = team.toLowerCase().trim();
                const countryCode = nationalTeams[teamLower];

                if (countryCode) {
                    nationalTeamCountries.push(countryCode);
                    console.log(`🚩 Equipo ${index + 1}: "${team}" → ${countryCode.toUpperCase()}`);
                } else {
                    console.log(`❌ Equipo ${index + 1}: "${team}" → No es selección nacional`);
                }
            });

            // Solo agregar banderas si encontramos selecciones nacionales
            if (nationalTeamCountries.length > 0) {
                enrichedEvent.nationalFlags = nationalTeamCountries;
                console.log(`✅ Banderas añadidas: ${nationalTeamCountries.join(', ')}`);
            } else {
                console.log(`⚠️ No se encontraron selecciones nacionales`);
            }

            return enrichedEvent;
        });
    };

    const getFilteredEvents = () => {
        if (!argentineDateTime) return events;

        const filtered = events.filter(event => {
            const matchesDate = selectedDate === 'todos' || event.date === selectedDate;
            const matchesSport = selectedSport === 'todos' || event.sport === selectedSport;

            try {
                const eventDateTime = new Date(`${event.date}T${event.time}:00`);
                const twoHoursAfterEvent = new Date(eventDateTime.getTime() + (2 * 60 * 60 * 1000));
                const isStillRelevant = argentineDateTime <= twoHoursAfterEvent;

                return matchesDate && matchesSport && isStillRelevant;
            } catch (error) {
                return matchesDate && matchesSport;
            }
        });

        return filtered.sort((a, b) => {
            const dateA = new Date(`${a.date}T${a.time}:00`);
            const dateB = new Date(`${b.date}T${b.time}:00`);
            return dateA - dateB;
        });
    };

    const filteredEvents = getFilteredEvents();    return (
        <div className="sports-agenda">
            {/* Header siempre visible */}
            <div className="agenda-header">
                <div className="header-content">
                    <h2>Agenda Deportiva</h2>                    <button
                        className="toggle-agenda-btn"
                        onClick={() => setIsAgendaVisible(!isAgendaVisible)}
                        title={isAgendaVisible ? "Ocultar contenido de la agenda" : "Mostrar contenido de la agenda"}
                    >
                        {isAgendaVisible ? 'Ocultar' : 'Mostrar'}
                    </button>
                </div>
                {isAgendaVisible && argentineDateTime && (
                    <div className="current-time">
                        {argentineDateTime.toLocaleString('es-AR', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'America/Argentina/Buenos_Aires'
                        })}
                    </div>
                )}
            </div>

            {/* Contenido que se puede ocultar */}
            {isAgendaVisible && (
                <div className="agenda-content">
                    <div className="filters-section">
                        <div className="filter-group">
                            <label htmlFor="date-filter">Fecha</label>
                            <select
                                id="date-filter"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                            >
                                <option value="todos">Todas las fechas</option>
                                {getAvailableDates().map(date => (
                                    <option key={date} value={date}>
                                        {new Date(date + 'T00:00:00').toLocaleDateString('es-ES', {
                                            weekday: 'short',
                                            day: 'numeric',
                                            month: 'short'
                                        })}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="filter-group">
                            <label htmlFor="sport-filter">Deporte</label>
                            <select
                                id="sport-filter"
                                value={selectedSport}
                                onChange={(e) => setSelectedSport(e.target.value)}
                            >
                                <option value="todos">Todos los deportes</option>
                                {getAvailableSports().map(sport => (
                                    <option key={sport} value={sport}>
                                        {sport}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <button
                            onClick={() => { setSelectedDate('todos'); setSelectedSport('todos'); }}
                            className="clear-filters-btn"
                        >
                            Limpiar filtros
                        </button>
                    </div>

                    {loading ? (
                        <div className="loading">Cargando eventos deportivos...</div>
                    ) : error ? (
                        <div className="error-message">Error: {error}</div>
                    ) : filteredEvents.length === 0 ? (
                        <div className="no-events">
                            No hay eventos disponibles que coincidan con los filtros seleccionados.
                        </div>
                    ) : (                        <div className="events-list">
                            {filteredEvents.map(event => (
                                <div key={event.id} className="event-card">
                                    {event.description && (
                                        <div className="tournament-badge">
                                            {event.description}
                                        </div>
                                    )}

                                    <div className="event-main">
                                        <div className="event-info">
                                            <h3 className="event-title">
                                                {event.teams && event.teams.length >= 2 
                                                    ? `${event.teams[0]} vs ${event.teams[1]}`
                                                    : event.name
                                                }
                                            </h3>

                                            <div className="event-meta">
                                                <div className="meta-item">
                                                    <span className="meta-icon">🕒</span>
                                                    <span>{event.time} - {getTimeUntilEvent(event.date, event.time)}</span>
                                                </div>
                                                <div className="meta-item">
                                                    <span className="meta-icon">🏅</span>
                                                    <span>{event.sport}</span>
                                                </div>
                                                {event.channels && event.channels.length > 0 && (
                                                    <div className="meta-item">
                                                        <span className="meta-icon">📺</span>
                                                        <span>{event.channels[0]}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>                                    <div className="servers-section">
                                        <button
                                            className="watch-live-btn"
                                            onClick={() => openEventInPlayer(event)}
                                        >
                                            <span className="play-icon">▶</span>
                                            <span>Ver Vivo ({getServersForEvent(event).length} opciones)</span>
                                        </button>
                                    </div></div>
                            ))}
                        </div>
                    )}                </div>
            )}
        </div>
    );
};

export default SportsAgenda;
