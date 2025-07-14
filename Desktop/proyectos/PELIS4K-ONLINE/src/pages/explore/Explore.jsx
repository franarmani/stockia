import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import ContentWrapper from "../../components/contentWrapper/ContentWrapper";
import MovieCard from "../../components/movieCard/MovieCard";
import Spinner from "../../components/spinner/Spinner";
import { loadLocalData } from "../../utils/localDataService";

import "./style.scss";

const Explore = () => {
    const [localItems, setLocalItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedGenres, setSelectedGenres] = useState([]);
    const [displayCount, setDisplayCount] = useState(20); // Paginación inicial
    const [showAllGenres, setShowAllGenres] = useState(false); // Estado para mostrar/ocultar géneros en móvil
    const { mediaType } = useParams();

    // Memoizar el procesamiento de datos para evitar re-cálculos innecesarios
    const processedData = useMemo(() => {
        if (!localItems.length) return { items: [], genres: [] };

        // Procesar solo una vez y mantener en memoria
        const uniqueItems = [];
        const seenIds = new Set();
        const genresSet = new Set();
        
        // Procesar items eliminando duplicados y extrayendo géneros en una sola pasada
        localItems.forEach(item => {
            if (!seenIds.has(item.id)) {
                seenIds.add(item.id);
                
                // Procesar géneros
                if (item.genres && Array.isArray(item.genres)) {
                    item.genres.forEach(genre => genresSet.add(genre));
                }
                
                // Agregar item procesado
                uniqueItems.push({
                    ...item,
                    vote_average: item.vote_average ?? 0,
                    popularity: item.popularity ?? 0,
                    primary_release_date: item.release_date ?? "",
                    original_title: item.title ?? item.name ?? "",
                    genre_ids: item.genre_ids ?? [],
                    genres: item.genres ?? [],
                });
            }
        });

        // Ordenar solo una vez
        uniqueItems.sort((a, b) => {
            if (b.vote_average !== a.vote_average) {
                return b.vote_average - a.vote_average;
            }
            return 0;
        });

        return {
            items: uniqueItems,
            genres: Array.from(genresSet).sort()
        };
    }, [localItems]);

    // Memoizar el filtrado para evitar re-filtros innecesarios
    const filteredItems = useMemo(() => {
        if (selectedGenres.length === 0) {
            return processedData.items;
        }
        
        return processedData.items.filter(item => {
            if (!item.genres || !Array.isArray(item.genres)) return false;
            return selectedGenres.some(selectedGenre => 
                item.genres.includes(selectedGenre)
            );
        });
    }, [processedData.items, selectedGenres]);

    // Memoizar los items a mostrar para paginación
    const itemsToShow = useMemo(() => {
        return filteredItems.slice(0, displayCount);
    }, [filteredItems, displayCount]);

    const fetchLocalData = useCallback(async () => {
        setLoading(true);
        setError(null);
        
        try {
            const data = await loadLocalData();
            const localData = (mediaType === "tv" ? data.series : data.movies) || [];

            // Invertir array de manera más eficiente
            const reversedData = [...localData].reverse();
            
            setLocalItems(reversedData);
            
        } catch (error) {
            console.warn("Error cargando datos:", error.message);
            setError("No se pudieron cargar los datos. Verifica tu conexión.");
            setLocalItems([]);
        } finally {
            setLoading(false);
        }
    }, [mediaType]);

    useEffect(() => {
        fetchLocalData();
        setDisplayCount(20); // Reset pagination when mediaType changes
        setSelectedGenres([]); // Reset filters when mediaType changes
    }, [fetchLocalData]);

    const handleGenreSelect = useCallback((genre) => {
        setSelectedGenres(prev => {
            if (prev.includes(genre)) {
                return prev.filter(g => g !== genre);
            } else {
                return [...prev, genre];
            }
        });
        setDisplayCount(20); // Reset pagination when filtering
    }, []);

    const clearFilters = useCallback(() => {
        setSelectedGenres([]);
        setDisplayCount(20);
    }, []);

    // Función para cargar más items (paginación)
    const loadMore = useCallback(() => {
        setDisplayCount(prev => prev + 20);
    }, []);

    // Verificar si hay más items para mostrar
    const hasMore = itemsToShow.length < filteredItems.length;

    return (
        <div className="explorePage">
            <ContentWrapper>
                <div className="pageHeader">
                    <div className="pageTitle">
                        {mediaType === "tv"
                            ? `Explora nuestras Series (${filteredItems.length})`
                            : `Explora nuestras Películas (${filteredItems.length})`}
                    </div>
                    {filteredItems.length > 20 && (
                        <div className="resultInfo">
                            Mostrando {itemsToShow.length} de {filteredItems.length} resultados
                        </div>
                    )}
                </div>
                
                {/* Filtros de género - Diseño minimalista y elegante */}
                {processedData.genres.length > 0 && (
                    <div className="filterSection">
                        <div className="filterContainer">
                            <div className="filterHeader">
                                <div className="filterTitle">
                                    <span className="filterIcon">🎯</span>
                                    <span>Filtrar por género</span>
                                    {selectedGenres.length > 0 && (
                                        <span className="filterCount">({selectedGenres.length})</span>
                                    )}
                                </div>
                                {selectedGenres.length > 0 && (
                                    <button 
                                        className="clearFilters" 
                                        onClick={clearFilters}
                                        title="Limpiar filtros"
                                    >
                                        <span className="clearIcon">✕</span>
                                        Limpiar
                                    </button>
                                )}
                            </div>
                            
                            <div className="genreList">
                                <div className={`genreContainer ${showAllGenres ? 'expanded' : 'collapsed'}`}>
                                    {processedData.genres.map(genre => (
                                        <button
                                            key={genre}
                                            className={`genreChip ${selectedGenres.includes(genre) ? 'selected' : ''}`}
                                            onClick={() => handleGenreSelect(genre)}
                                        >
                                            {genre}
                                        </button>
                                    ))}
                                </div>
                                
                                {/* Botón mostrar más géneros - solo visible en móvil */}
                                {processedData.genres.length > 6 && (
                                    <button 
                                        className="showMoreGenres"
                                        onClick={() => setShowAllGenres(!showAllGenres)}
                                    >
                                        <span className="showMoreIcon">
                                            {showAllGenres ? '▲' : '▼'}
                                        </span>
                                        {showAllGenres ? 'Mostrar menos' : `Mostrar más géneros (+${processedData.genres.length - 6})`}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                
                {loading ? (
                    <Spinner initial={true} />
                ) : error ? (
                    <div className="errorMessage">
                        <span className="resultNotFound">{error}</span>
                        <button 
                            className="retryButton" 
                            onClick={() => {
                                setError(null);
                                fetchLocalData();
                            }}
                        >
                            Reintentar
                        </button>
                    </div>
                ) : filteredItems.length > 0 ? (
                    <>
                        <div className="content mobile-two-columns explore-grid">
                            {itemsToShow.map((item) => (
                                <MovieCard
                                    key={`${mediaType}-${item.id}`}
                                    data={item}
                                    mediaType={mediaType}
                                />
                            ))}
                        </div>
                        {hasMore && (
                            <div className="loadMoreContainer">
                                <button 
                                    className="loadMoreButton" 
                                    onClick={loadMore}
                                >
                                    Cargar más {mediaType === "tv" ? "series" : "películas"} ({filteredItems.length - itemsToShow.length} restantes)
                                </button>
                            </div>
                        )}
                    </>
                ) : selectedGenres.length > 0 ? (
                    <div className="noResults">
                        <span className="resultNotFound">
                            No se encontraron {mediaType === "tv" ? "series" : "películas"} con los géneros seleccionados.
                        </span>
                        <button className="clearFiltersButton" onClick={clearFilters}>
                            Limpiar filtros
                        </button>
                    </div>
                ) : (
                    <span className="resultNotFound">
                        Disculpanos, Resultados no encontrados!
                    </span>
                )}
            </ContentWrapper>
        </div>
    );
};

export default Explore;
