import React from 'react';
import "./style.scss";
import HeroBanner from "./heroBanner/HeroBanner";
import TrendingSeries from './trending/TrendingSeries';
import Trending from './trending/Trending';
import Popular from './popular/Popular';
import TopRated from './topRated/TopRated';

const Home = () => {
  return (
    <div className='homePage'>
      <HeroBanner />
      <Trending />
      <TrendingSeries />
      <Popular />
      <TopRated />
    </div>
  )
}

export default Home