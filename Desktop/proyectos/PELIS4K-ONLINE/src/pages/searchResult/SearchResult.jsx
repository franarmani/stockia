import React, { useState, useEffect } from 'react';
import "./style.scss";
import { useParams } from 'react-router-dom';
import InfiniteScroll from 'react-infinite-scroll-component';
import { fetchDataFromApi } from './../../utils/api';
import { loadLocalData } from '../../utils/localDataService';
import ContentWrapper from './../../components/contentWrapper/ContentWrapper';
import Spinner from '../../components/spinner/Spinner';
import MovieCard from '../../components/movieCard/MovieCard';

const SearchResult = () => {
    const [data, setData] = useState([]);
    const [pageNum, setPageNum] = useState(1);
    const [loading, setLoading] = useState(false);
    const [totalPages, setTotalPages] = useState(1);
    const { query } = useParams();

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            // 🔥 Buscamos resultados en TMDB con idioma español
            const tmdbResponse = await fetchDataFromApi(
                `/search/multi?query=${query}&page=1&language=es-ES`
            );
            const tmdbIds = tmdbResponse?.results?.map(item => item.id) || [];

            // 🔥 Cargamos data.json usando el servicio centralizado
            const localDataResult = await loadLocalData();

            const movieItems = (localDataResult.movies || []).map(item => ({
                ...item,
                media_type: "movie",
            }));
            const seriesItems = (localDataResult.series || []).map(item => ({
                ...item,
                media_type: "tv",
            }));
            const localData = [...movieItems, ...seriesItems];

            // 🔥 Filtramos solo los resultados que están en data.json
            const filteredData = localData.filter(item =>
                tmdbIds.includes(parseInt(item.id))
            );

            setData(filteredData);
            setTotalPages(tmdbResponse.total_pages);
            setPageNum(2);
        } catch (error) {
            console.error("Error cargando resultados", error);
            setData([]);
        }
        setLoading(false);
    };

    const fetchNextPageData = async () => {
        if (pageNum > totalPages) return;
        setLoading(true);
        try {
            const tmdbResponse = await fetchDataFromApi(
                `/search/multi?query=${query}&page=${pageNum}&language=es-ES`
            );
            const tmdbIds = tmdbResponse?.results?.map(item => item.id) || [];

            const localDataResult = await loadLocalData();

            const movieItems = (localDataResult.movies || []).map(item => ({
                ...item,
                media_type: "movie",
            }));
            const seriesItems = (localDataResult.series || []).map(item => ({
                ...item,
                media_type: "tv",
            }));
            const localData = [...movieItems, ...seriesItems];

            const filteredData = localData.filter(item =>
                tmdbIds.includes(parseInt(item.id))
            );

            setData(prev => [...prev, ...filteredData]);
            setPageNum(prev => prev + 1);
        } catch (error) {
            console.error("Error cargando más resultados", error);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchInitialData();
    }, [query]);

    return (
        <div className='searchResultsPage'>
            {loading && <Spinner initial={true} />}
            {!loading && (
                <ContentWrapper>
                    {data?.length > 0 ? (
                        <>
                            <div className="pageTitle">
                                {`Resultados de búsqueda (${data?.length} ${
                                    data?.length === 1 ? "resultado" : "resultados"
                                }) para '${query}'`}
                            </div>
                            <InfiniteScroll
                                className='content'
                                dataLength={data?.length}
                                next={fetchNextPageData}
                                hasMore={pageNum <= totalPages}
                                loader={<Spinner />}
                            >
                                {data.map((item) => (
                                    <MovieCard
                                        key={`${item.id}-${item.media_type || 'unknown'}`}
                                        data={item}
                                        mediaType={item.media_type}
                                        fromSearch={true}
                                    />
                                ))}
                            </InfiniteScroll>
                        </>
                    ) : (
                        <span className="resultNotFound">
                            Lo sentimos, sin resultados.
                        </span>
                    )}
                </ContentWrapper>
            )}
        </div>
    );
};

export default SearchResult;
