import React, { useRef } from "react";
import {
    BsFillArrowLeftCircleFill,
    BsFillArrowRightCircleFill,
} from "react-icons/bs";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import dayjs from "dayjs";

import ContentWrapper from "../contentWrapper/ContentWrapper";
import Img from "../lazyLoadImage/img";
import PosterFallback from "../../assets/no-poster.png";

import "./style.scss";
import CircleRating from "../circleRating/CircleRating";
import Genres from "../genres/Genres";

const Carousel = ({ data, loading, endpoint, title, showRating = true }) => {
    const carouselContainer = useRef();
    const { url } = useSelector((state) => state.home);
    const navigate = useNavigate();

    const navigation = (dir) => {
        const container = carouselContainer.current;
        const scrollAmount =
            dir === "left"
                ? container.scrollLeft - (container.offsetWidth + 20)
                : container.scrollLeft + (container.offsetWidth + 20);
        container.scrollTo({
            left: scrollAmount,
            behavior: "smooth",
        });
    };

    return (
        <div className="carousel">
            <ContentWrapper>
                {title && <div className="carouselTitle">{title}</div>}
                <BsFillArrowLeftCircleFill
                    className="carouselLeftNav arrow"
                    onClick={() => navigation("left")}
                />
                <BsFillArrowRightCircleFill
                    className="carouselRighttNav arrow"
                    onClick={() => navigation("right")}
                />
                {!loading ? (
                    <div className="carouselItems" ref={carouselContainer}>
                        {data?.map((item, index) => {
                            const posterUrl = item.poster_path
                                ? url.poster + item.poster_path
                                : PosterFallback;
                            const safeVoteAverage =
                                typeof item.vote_average === "number"
                                    ? item.vote_average.toFixed(1)
                                    : "N/A";
                            const safeGenres = Array.isArray(item.genre_ids)
                                ? item.genre_ids.slice(0, 2)
                                : [];
                            const safeDate = item.release_date
                                ? dayjs(item.release_date).format("MMM D, YYYY")
                                : "Fecha desconocida";

                            return (
                                <div
                                    className="carouselItem"
                                    key={`${endpoint || 'carousel'}-${item.id}-${index}`}
                                    onClick={() =>
                                        navigate(
                                            `/${item.media_type || endpoint}/${item.id}`
                                        )
                                    }
                                >
                                    <div className="posterBlock">
                                        <Img src={posterUrl} />
                                        {showRating && (
                                            <CircleRating rating={safeVoteAverage} />
                                        )}
                                        <Genres data={safeGenres} />
                                    </div>
                                    <div className="textBlock">
                                        <span className="title">
                                            {item.title || item.name}
                                        </span>
                                        <span className="date">{safeDate}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="loadingSkeleton">
                        {Array.from({ length: 5 }, (_, index) => (
                            <div key={`skeleton-${index}`} className="skeletonItem">
                                <div className="posterBlock skeleton"></div>
                                <div className="textBlock">
                                    <div className="title skeleton"></div>
                                    <div className="date skeleton"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </ContentWrapper>
        </div>
    );
};

export default Carousel;
