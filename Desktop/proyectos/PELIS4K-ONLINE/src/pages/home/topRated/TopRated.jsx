import React, { useState, useEffect } from 'react';
import ContentWrapper from '../../../components/contentWrapper/ContentWrapper';
import SwitchTabs from '../../../components/switchTabs/SwitchTabs';
import Carousel from '../../../components/carousel/Carousel';
import { fetchDataFromApi } from '../../../utils/api';
import { loadLocalData } from '../../../utils/localDataService';

const TopRated = () => {
    const [endpoint, setEndpoint] = useState("movie");
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchTopRatedData = async (type) => {
        setLoading(true);
        try {
            const tmdbResponse = await fetchDataFromApi(`/${type}/top_rated`);
            const tmdbIds = tmdbResponse?.results?.map(item => item.id) || [];

            const localDataResult = await loadLocalData();
            const localData = type === "movie" ? localDataResult.movies : localDataResult.series;

            // 🔥 Filtrar por id y eliminar duplicados
            const topRatedLocal = localData.filter(item => tmdbIds.includes(parseInt(item.id)));
            const uniqueItems = [];
            const seenIds = new Set();
            for (const item of topRatedLocal) {
                if (!seenIds.has(item.id)) {
                    uniqueItems.push(item);
                    seenIds.add(item.id);
                }
            }

            setData(uniqueItems);
        } catch (error) {
            console.error("Error buscando top rated o cargando data.json", error);
            setData([]);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchTopRatedData(endpoint);
    }, [endpoint]);

    const onTabChange = (tab) => {
        setEndpoint(tab === "Películas" ? "movie" : "tv");
    };

    return (
        <div className='carouselSection'>
            <ContentWrapper>
                <span className="carouselTitle">Mejores valoradas</span>
                <SwitchTabs data={["Películas", "Series"]} onTabChange={onTabChange} />
            </ContentWrapper>
            <Carousel data={data} loading={loading} endpoint={endpoint} showRating={false} />
        </div>
    );
}

export default TopRated