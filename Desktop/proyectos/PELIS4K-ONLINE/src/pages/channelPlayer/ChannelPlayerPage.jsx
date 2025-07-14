import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import ChannelPlayer from '../../components/channelPlayer/ChannelPlayer';

const ChannelPlayerPage = () => {
    const { channelId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [channelData, setChannelData] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        try {
            // Get channel data from URL parameters
            const channelDataParam = searchParams.get('channelData');
              if (channelDataParam) {
                try {
                    const decodedData = JSON.parse(decodeURIComponent(channelDataParam));
                    // Validar que tenga las propiedades mínimas necesarias
                    if (decodedData && typeof decodedData === 'object') {
                        setChannelData({
                            id: decodedData.id || 'unknown',
                            name: decodedData.name || 'Canal Desconocido',
                            iframeUrl: decodedData.iframeUrl || '',
                            iframeUrl2: decodedData.iframeUrl2 || null,
                            image: decodedData.image || '/logo.png'
                        });
                    } else {
                        throw new Error('Datos de canal inválidos');
                    }
                } catch (parseError) {
                    console.error('Error parsing channel data:', parseError);
                    setError('Error al procesar los datos del canal');
                }} else if (channelId) {
                // Fallback: create basic channel data from ID
                setChannelData({
                    id: channelId,
                    name: `Canal ${channelId}`,
                    iframeUrl: '',
                    image: '/logo.png'
                });
            } else {
                setError('No se encontraron datos del canal');
            }
        } catch (err) {
            console.error('Error parsing channel data:', err);
            setError('Error al cargar los datos del canal');
        }
    }, [channelId, searchParams]);

    if (error) {
        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #0b0b0b, #1a0033)',
                color: 'white',
                fontFamily: 'Segoe UI, sans-serif'
            }}>
                <div style={{ textAlign: 'center', padding: '40px' }}>
                    <h2>Error</h2>
                    <p>{error}</p>                    <button 
                        onClick={() => window.history.back()}
                        style={{
                            background: 'linear-gradient(135deg, #ff69b4, #8a2be2)',
                            color: 'white',
                            border: 'none',
                            padding: '12px 24px',
                            borderRadius: '25px',
                            cursor: 'pointer',
                            marginTop: '20px'
                        }}
                    >
                        Volver
                    </button>
                </div>
            </div>
        );
    }

    if (!channelData) {
        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #0b0b0b, #1a0033)',
                color: 'white'
            }}>
                <div>Cargando canal...</div>
            </div>
        );
    }

    return <ChannelPlayer channel={channelData} />;
};

export default ChannelPlayerPage;
