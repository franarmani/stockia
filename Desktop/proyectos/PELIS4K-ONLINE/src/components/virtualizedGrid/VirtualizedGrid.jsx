import React, { useState, useEffect, useRef, useMemo } from 'react';

const VirtualizedGrid = ({ 
    items, 
    renderItem, 
    itemsPerRow = 4, 
    itemHeight = 400, 
    containerHeight = 600,
    overscan = 2 
}) => {
    const [startIndex, setStartIndex] = useState(0);
    const scrollElementRef = useRef(null);
    
    // Calcular cuántas filas necesitamos mostrar
    const rowHeight = itemHeight;
    const visibleRows = Math.ceil(containerHeight / rowHeight);
    const totalRows = Math.ceil(items.length / itemsPerRow);
    
    // Calcular índices de inicio y fin con overscan
    const endIndex = Math.min(
        startIndex + (visibleRows + overscan) * itemsPerRow,
        items.length
    );
    
    // Items visibles
    const visibleItems = useMemo(() => {
        return items.slice(startIndex, endIndex);
    }, [items, startIndex, endIndex]);
    
    // Altura total del contenedor virtual
    const totalHeight = totalRows * rowHeight;
    
    // Offset para posicionar correctamente los items visibles
    const offsetY = Math.floor(startIndex / itemsPerRow) * rowHeight;
    
    useEffect(() => {
        const handleScroll = () => {
            if (!scrollElementRef.current) return;
            
            const scrollTop = scrollElementRef.current.scrollTop;
            const newStartIndex = Math.floor(scrollTop / rowHeight) * itemsPerRow;
            
            if (newStartIndex !== startIndex) {
                setStartIndex(Math.max(0, newStartIndex - overscan * itemsPerRow));
            }
        };
        
        const scrollElement = scrollElementRef.current;
        if (scrollElement) {
            scrollElement.addEventListener('scroll', handleScroll, { passive: true });
            return () => scrollElement.removeEventListener('scroll', handleScroll);
        }
    }, [startIndex, rowHeight, itemsPerRow, overscan]);
    
    // Organizar items en filas
    const rows = [];
    for (let i = 0; i < visibleItems.length; i += itemsPerRow) {
        rows.push(visibleItems.slice(i, i + itemsPerRow));
    }
    
    return (
        <div 
            ref={scrollElementRef}
            style={{
                height: containerHeight,
                overflow: 'auto',
                position: 'relative'
            }}
        >
            <div style={{ height: totalHeight, position: 'relative' }}>
                <div 
                    style={{
                        transform: `translateY(${offsetY}px)`,
                        position: 'relative'
                    }}
                >
                    {rows.map((row, rowIndex) => (
                        <div 
                            key={startIndex + rowIndex * itemsPerRow}
                            style={{
                                display: 'flex',
                                gap: '20px',
                                marginBottom: '20px',
                                height: rowHeight - 20 // Restar el margen
                            }}
                        >
                            {row.map((item, itemIndex) => (
                                <div key={item.id || (startIndex + rowIndex * itemsPerRow + itemIndex)}>
                                    {renderItem(item, startIndex + rowIndex * itemsPerRow + itemIndex)}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default VirtualizedGrid;
