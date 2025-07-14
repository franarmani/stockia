import React, { useState, useEffect } from 'react';
import ContentWrapper from '../../../components/contentWrapper/ContentWrapper';
import SwitchTabs from '../../../components/switchTabs/SwitchTabs';
import Carousel from '../../../components/carousel/Carousel';
import { fetchDataFromApi } from '../../../utils/api';
import { loadLocalData } from '../../../utils/localDataService';

const Popular = () => {
    const [endpoint, setEndpoint] = useState("movie");
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchPopularData = async (type) => {
        setLoading(true);
        try {
            const tmdbResponse = await fetchDataFromApi(`/${type}/popular`);
            const tmdbIds = tmdbResponse?.results?.map(item => item.id) || [];

            const localDataResult = await loadLocalData();
            const localData = type === "movie" ? localDataResult.movies : localDataResult.series;

            // 🔥 Filtrar por id y eliminar duplicados
            const popularLocal = localData.filter(item => tmdbIds.includes(parseInt(item.id)));
            const uniqueItems = [];
            const seenIds = new Set();
            for (const item of popularLocal) {
                if (!seenIds.has(item.id)) {
                    uniqueItems.push(item);
                    seenIds.add(item.id);
                }
            }

            setData(uniqueItems);
        } catch (error) {
            console.error("Error buscando populares o cargando data.json", error);
            setData([]);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchPopularData(endpoint);
    }, [endpoint]);

    const onTabChange = (tab) => {
        setEndpoint(tab === "Películas" ? "movie" : "tv");
    };

    return (
        <div className='carouselSection'>
            <ContentWrapper>
                <span className="carouselTitle">Películas Populares</span>
            </ContentWrapper>
            <Carousel data={data} loading={loading} endpoint={endpoint} showRating={false} />
        </div>
    );
};

export default Popular;
