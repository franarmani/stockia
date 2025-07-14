import React, { useState, useEffect } from 'react';
import './style.scss';
import { useNavigate } from 'react-router-dom';
import useFetch from '../../../hooks/useFetch';
import { useSelector } from 'react-redux';
import Img from '../../../components/lazyLoadImage/img';
import ContentWrapper from '../../../components/contentWrapper/ContentWrapper';

const HeroBanner = () => {
  const [background, setBackground] = useState('');
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { url } = useSelector((state) => state.home);

  const { data, loading } = useFetch('/movie/popular');

  useEffect(() => {
    if (data?.results?.length) {
      const randIndex = Math.floor(Math.random() * data.results.length);
      const path = data.results[randIndex].backdrop_path || data.results[randIndex].poster_path;
      setBackground(url.backdrop + path);
    }
  }, [data, url.backdrop]);

  const searchQueryHandler = (event) => {
    if (event.key === 'Enter' && query.trim()) {
      navigate(`/search/${query.trim()}`);
    }
  };

  const searchItem = () => {
    if (query.trim()) {
      navigate(`/search/${query.trim()}`);
    }
  };

  return (
    <div className="heroBanner">
      {!loading && background && (
        <div className="backdrop-img">
          <Img src={background} alt="Fondo destacado" />
        </div>
      )}

      <div className="opacity-layer" />

      <ContentWrapper>
        <div className="heroBannerContent">
          <span className="title">Pelis4K</span>
          <span className="subTitle">
            La mejor plataforma para ver películas y series en 4K!
          </span>
          <div className="searchInput">
            <input
              type="text"
              placeholder="Buscar película o serie..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyUp={searchQueryHandler}
            />
            <button onClick={searchItem}>Buscar</button>
          </div>
        </div>
      </ContentWrapper>
    </div>
  );
};

export default HeroBanner;