import React, { useState, useEffect } from "react";
import Carousel from "../../../components/carousel/Carousel";
import { fetchDataFromApi } from "../../../utils/api";
import { loadLocalData } from "../../../utils/localDataService";

const Similar = ({ mediaType, id }) => {
    const [similarItems, setSimilarItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSimilar = async () => {
            setLoading(true);
            try {
                const tmdbResponse = await fetchDataFromApi(`/${mediaType}/${id}/similar`);
                const tmdbIds = tmdbResponse?.results?.map(item => item.id) || [];

                const localDataResult = await loadLocalData();
                const localData = (mediaType === "tv" ? localDataResult.series : localDataResult.movies) || [];

                const similarInLocal = localData.filter(item => tmdbIds.includes(parseInt(item.id)));
                setSimilarItems(similarInLocal);
            } catch (error) {
                console.error("Error buscando similares o cargando data.json", error);
                setSimilarItems([]);
            }
            setLoading(false);
        };

        fetchSimilar();
    }, [mediaType, id]);

    const title = mediaType === "tv" ? "Series Similares" : "Películas Similares";

    if (!loading && similarItems.length === 0) {
        return null;
    }

    return (
        <Carousel
            title={title}
            data={similarItems}
            loading={loading}
            endpoint={mediaType}
            showRating={false}  // 🔥 ocultar puntaje
        />
    );
};

export default Similar;
