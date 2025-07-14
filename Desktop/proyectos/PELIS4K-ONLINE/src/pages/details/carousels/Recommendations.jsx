import React, { useState, useEffect } from "react";
import Carousel from "../../../components/carousel/Carousel";
import { fetchDataFromApi } from "../../../utils/api";
import { loadLocalData } from "../../../utils/localDataService";

const Recommendation = ({ mediaType, id }) => {
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRecommendations = async () => {
            setLoading(true);
            try {
                const tmdbResponse = await fetchDataFromApi(`/${mediaType}/${id}/recommendations`);
                const tmdbIds = tmdbResponse?.results?.map(item => item.id) || [];

                const localDataResult = await loadLocalData();
                const localData = (mediaType === "tv" ? localDataResult.series : localDataResult.movies) || [];

                const recommendationsInLocal = localData.filter(item => tmdbIds.includes(parseInt(item.id)));
                setRecommendations(recommendationsInLocal);
            } catch (error) {
                console.error("Error buscando recomendaciones o cargando data.json", error);
                setRecommendations([]);
            }
            setLoading(false);
        };

        fetchRecommendations();
    }, [mediaType, id]);

    if (!loading && recommendations.length === 0) {
        return null;
    }

    return (
        <Carousel
            title="Recomendaciones"
            data={recommendations}
            loading={loading}
            endpoint={mediaType}
            showRating={false}  // 🔥 ocultar puntaje
        />
    );
};

export default Recommendation;
