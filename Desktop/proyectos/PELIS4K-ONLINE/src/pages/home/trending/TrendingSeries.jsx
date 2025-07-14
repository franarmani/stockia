import React, { useState, useEffect } from 'react';
import ContentWrapper from '../../../components/contentWrapper/ContentWrapper';
import SwitchTabs from '../../../components/switchTabs/SwitchTabs';
import Carousel from '../../../components/carousel/Carousel';
import { fetchDataFromApi } from '../../../utils/api';
import { loadLocalData } from '../../../utils/localDataService';

const TrendingSeries = () => {
    const [endpoint, setEndpoint] = useState("day");
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);    const fetchTrendingData = async (timeWindow) => {
        setLoading(true);
        try {
            // 🔥 Buscamos trending series en TMDB
            const tmdbResponse = await fetchDataFromApi(`/trending/tv/${timeWindow}`);
            const tmdbIds = tmdbResponse?.results?.map(item => item.id) || [];

            // 🔥 Usamos el servicio centralizado para cargar datos locales
            const localDataResult = await loadLocalData();
            const localSeries = localDataResult.series || [];

            // 🔥 Filtramos solo las series que estén en TMDB trending y en data.json
            const trendingLocal = localSeries.filter(item => tmdbIds.includes(parseInt(item.id)));

            // 🔥 Eliminamos duplicados
            const uniqueItems = [];
            const seenIds = new Set();
            for (const item of trendingLocal) {
                if (!seenIds.has(item.id)) {
                    uniqueItems.push(item);
                    seenIds.add(item.id);
                }
            }

            setData(uniqueItems);
        } catch (error) {
            console.error("Error buscando series trending o cargando data.json", error);
            setData([]);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchTrendingData(endpoint);
    }, [endpoint]);

    const onTabChange = (tab) => {
        setEndpoint(tab === "Hoy" ? "day" : "week");  // 🔥 "Hoy" y "Semanal"
    };


    return (
        <div className='carouselSection'>
            <ContentWrapper>
                <span className="carouselTitle">Series en tendencia</span>
            </ContentWrapper>
            <Carousel data={data} loading={loading} endpoint="tv" showRating={false} />
        </div>
    );
};

export default TrendingSeries;
