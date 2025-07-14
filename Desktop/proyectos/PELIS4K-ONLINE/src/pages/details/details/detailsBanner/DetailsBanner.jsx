import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import dayjs from "dayjs";
import "dayjs/locale/es";

import "./style.scss";

import ContentWrapper from "../../../components/contentWrapper/ContentWrapper";
import useFetch from "../../../hooks/useFetch";
import Genres from "../../../components/genres/Genres";
import CircleRating from "../../../components/circleRating/CircleRating";
import Img from "../../../components/lazyLoadImage/img";
import PosterFallback from "../../../assets/no-poster.png";
import { PlayIcon } from "../Playbtn";
import VideoPopup from "../../../components/videoPopup/VideoPopup";

dayjs.locale('es');

const DetailsBanner = ({ video, crew }) => {
  const [show, setShow] = useState(false);
  const [videoId, setVideoId] = useState(null);

  const { mediaType, id } = useParams();
  const { data, loading } = useFetch(`/${mediaType}/${id}`);
  const { url } = useSelector((state) => state.home);

  const _genres = data?.genres?.map((g) => g.id);
  const director = crew?.filter((f) => f.job === "Director");
  const writer = crew?.filter(
    (f) => f.job === "Screenplay" || f.job === "Story" || f.job === "Writer"
  );

  const toHoursAndMinutes = (totalMinutes) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h${minutes > 0 ? ` ${minutes}m` : ""}`;
  };

  return (
    <div className="detailsBanner">
      {!loading && data ? (
        <>
          <div className="backdrop-img">
            <Img src={url.backdrop + data.backdrop_path} />
          </div>
          <div className="opacity-layer"></div>
          <ContentWrapper>
            <div className="content">
              <div className="left">
                {data.poster_path ? (
                  <Img className="posterImg" src={url.backdrop + data.poster_path} />
                ) : (
                  <Img className="posterImg" src={PosterFallback} />
                )}
              </div>
              <div className="right">
                {/* Título con año */}
                <h2 className="title">
                  {`${data.name || data.title} (${dayjs(data.release_date).format('YYYY')})`}
                </h2>
                {/* Lema */}
                {data.tagline && <p className="subtitle">{data.tagline}</p>}
                {/* Géneros */}
                <Genres data={_genres} />
                {/* Puntuación y tráiler */}
                <div className="row">
                  <CircleRating rating={data.vote_average.toFixed(1)} />
                  <div
                    className="playbtn"
                    onClick={() => {
                      setShow(true);
                      setVideoId(video.key);
                    }}
                  >
                    <PlayIcon />
                    <span className="text">Ver tráiler</span>
                  </div>
                </div>
                {/* Sinopsis */}
                <div className="overview">
                  <h3 className="heading">Sinopsis</h3>
                  <p className="description">{data.overview}</p>
                </div>
                {/* Información adicional */}
                <div className="info">
                  {data.status && (
                    <div className="infoItem">
                      <span className="text bold">Estado: </span>
                      <span className="text">{data.status}</span>
                    </div>
                  )}
                  {data.release_date && (
                    <div className="infoItem">
                      <span className="text bold">Fecha de estreno: </span>
                      <span className="text">
                        {dayjs(data.release_date).format('D [de] MMMM [de] YYYY')}
                      </span>
                    </div>
                  )}
                  {data.runtime && (
                    <div className="infoItem">
                      <span className="text bold">Duración: </span>
                      <span className="text">{toHoursAndMinutes(data.runtime)}</span>
                    </div>
                  )}
                </div>
                {/* Director/es */}
                {director?.length > 0 && (
                  <div className="info">
                    <span className="text bold">Director: </span>
                    <span className="text">
                      {director.map((d, i) => (
                        <span key={i}>
                          {d.name}
                          {i < director.length - 1 && ', '}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
                {/* Guionista/s */}
                {writer?.length > 0 && (
                  <div className="info">
                    <span className="text bold">Guionista: </span>
                    <span className="text">
                      {writer.map((w, i) => (
                        <span key={i}>
                          {w.name}
                          {i < writer.length - 1 && ', '}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
                {/* Creador/es (para series) */}
                {data.created_by?.length > 0 && (
                  <div className="info">
                    <span className="text bold">Creador: </span>
                    <span className="text">
                      {data.created_by.map((c, i) => (
                        <span key={i}>
                          {c.name}
                          {i < data.created_by.length - 1 && ', '}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <VideoPopup show={show} setShow={setShow} videoId={videoId} setVideoId={setVideoId} />
          </ContentWrapper>
        </>
      ) : (
        <div className="detailsBannerSkeleton">
          <ContentWrapper>
            <div className="left skeleton"></div>
            <div className="right">
              <div className="row skeleton"></div>
              <div className="row skeleton"></div>
              <div className="row skeleton"></div>
              <div className="row skeleton"></div>
              <div className="row skeleton"></div>
              <div className="row skeleton"></div>
            </div>
          </ContentWrapper>
        </div>
      )}
    </div>
  );
};

export default DetailsBanner;