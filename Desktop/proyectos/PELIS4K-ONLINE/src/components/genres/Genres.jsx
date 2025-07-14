import React from 'react';
import './style.scss';
import { useSelector } from 'react-redux';

const Genres = ({ data = [] }) => {
  const { genres } = useSelector((state) => state.home);

  return (
    <div className="genres">
      {data
        .map((genreId) => genres[genreId])     // extrae el objeto género
        .filter(Boolean)                       // descarta ids sin género
        .map((genre) => (
          <span key={genre.id} className="genre">
            {genre.name}
          </span>
        ))
      }
    </div>
  );
};

export default Genres;
