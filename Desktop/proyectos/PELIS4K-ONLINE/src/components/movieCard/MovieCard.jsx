import React from "react";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";

import "./style.scss";
import Img from "../lazyLoadImage/img";
import CircleRating from "../circleRating/CircleRating";
import Genres from "../genres/Genres";
import PosterFallback from "../../assets/no-poster.png";

const MovieCard = ({ data, fromSearch, mediaType }) => {
    const { url } = useSelector((state) => state.home);
    const navigate = useNavigate();
    const posterUrl = data.poster_path
        ? url.poster + data.poster_path
        : PosterFallback;

    const safeVoteAverage = typeof data.vote_average === 'number' ? data.vote_average.toFixed(1) : "N/A";
    const safeGenres = Array.isArray(data.genre_ids) ? data.genre_ids.slice(0, 2) : [];

    return (
        <div
            className="movieCard"
            onClick={() =>
                navigate(`/${data.media_type || mediaType}/${data.id}`)
            }
        >
            <div className="posterBlock">
                <Img className="posterImg" src={posterUrl} />
                {!fromSearch && (
                    <React.Fragment>
                        {/* <CircleRating rating={safeVoteAverage} /> */}
                        <Genres data={safeGenres} />
                    </React.Fragment>
                )}
            </div>
            <div className="textBlock">
                <span className="title">{data.title || data.name}</span>
                <span className="date">
                    {data.release_date
                        ? dayjs(data.release_date).format("MMM D, YYYY")
                        : "Fecha desconocida"}
                </span>
            </div>
        </div>
    );
};

export default MovieCard;
