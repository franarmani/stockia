#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Convertidor de texto de agenda deportiva a JSON
Convierte el texto de la agenda deportiva a formato JSON para sports_events.json
"""

import json
import re
from datetime import datetime, timedelta

def get_country_code(team_name):
    """Mapea nombres de equipos/países a códigos de banderas"""
    country_mapping = {
        # Países
        'FRANCIA': 'fr', 'ALEMANIA': 'de', 'BÉLGICA': 'be', 'BRASIL': 'br',
        'PAÍSES BAJOS': 'nl', 'POLONIA': 'pl', 'REPÚBLICA DOMINICANA': 'do',
        'TURQUÍA': 'tr', 'SERBIA': 'rs', 'ESTADOS UNIDOS': 'us', 'INDIA': 'in',
        'ARGENTINA': 'ar', 'ESPAÑA': 'es', 'INGLATERRA': 'gb', 'AUSTRALIA': 'au',
        'COSTA RICA': 'cr', 'HAITÍ': 'ht', 'TRINIDAD Y TOBAGO': 'tt',
        'ARABIA SAUDITA': 'sa', 'SURINAM': 'sr', 'MÉXICO': 'mx', 'TAILANDIA': 'th',
        'ITALIA': 'it', 'BULGARIA': 'bg', 'CHINA': 'cn',
        
        # Clubes por país
        'MANCHESTER CITY': 'gb', 'WYDAD AC': 'ma', 'REAL MADRID': 'es',
        'AL HILAL': 'sa', 'PACHUCA': 'mx', 'SALZBURGO': 'at', 'AL AIN': 'ae',
        'JUVENTUS': 'it', 'SEATTLE SOUNDERS': 'us', 'ATLÉTICO MADRID': 'es',
        'PALMEIRAS': 'br', 'AL AHLY': 'eg', 'INTER MIAMI': 'us', 'PORTO': 'pt',
        'BOTAFOGO': 'br', 'PSG': 'fr', 'BENFICA': 'pt', 'AUCKLAND CITY': 'nz',
        'FLAMENGO': 'br', 'CHELSEA': 'gb', 'LOS ANGELES FC': 'us', 'ESPERACE': 'tn',
        'BAYERN MUNICH': 'de', 'BOCA': 'ar', 'MAMELODI SUNDOWNS': 'za',
        'BORUSSIA DORTMUND': 'de', 'INTER DE MILÁN': 'it', 'URAWA RED DIAMONDS': 'jp',
        'FLUMINENSE': 'br', 'ULSAN HYUNDAI': 'kr', 'RIVER': 'ar',
        'RAYADOS DE MONTERREY': 'mx', 'MILWAUKEE BREWERS': 'us', 'CHICAGO CUBS': 'us',
        'INDIANA PACERS': 'us', 'OKLAHOMA CITY THUNDERS': 'us', 'MILWAUKEE BUCKS': 'us'
    }
    
    team_upper = team_name.upper().strip()
    return country_mapping.get(team_upper, None)

def get_sport_from_context(context):
    """Determina el deporte basado en el contexto"""
    context_upper = context.upper()
    
    if 'MUNDIAL DE CLUBES' in context_upper:
        return 'Fútbol'
    elif 'VOLEY' in context_upper or 'VOLLEY' in context_upper:
        return 'Volley'
    elif 'CICLISMO' in context_upper:
        return 'Ciclismo'
    elif 'HOCKEY' in context_upper:
        return 'Hockey'
    elif 'COPA ORO' in context_upper or 'CONCACAF' in context_upper:
        return 'Fútbol'
    elif 'MLB' in context_upper or 'BASEBALL' in context_upper:
        return 'Baseball'
    elif 'NBA' in context_upper:
        return 'Básquet'
    elif 'GOLF' in context_upper:
        return 'Golf'
    elif 'KNOCKOUT' in context_upper or 'BOXEO' in context_upper:
        return 'Boxeo'
    else:
        return 'Fútbol'  # Default

def parse_date_from_text(text):
    """Extrae la fecha del texto"""
    # Buscar patrones de fecha
    date_patterns = [
        r'(\d{1,2})\s+DE\s+(\w+)\s+DE\s+(\d{4})',
        r'(MIÉRCOLES|JUEVES|VIERNES|SÁBADO|DOMINGO|LUNES|MARTES)\s+(\d{1,2})\s+DE\s+(\w+)',
    ]
    
    months = {
        'ENERO': 1, 'FEBRERO': 2, 'MARZO': 3, 'ABRIL': 4, 'MAYO': 5, 'JUNIO': 6,
        'JULIO': 7, 'AGOSTO': 8, 'SEPTIEMBRE': 9, 'OCTUBRE': 10, 'NOVIEMBRE': 11, 'DICIEMBRE': 12
    }
    
    for pattern in date_patterns:
        match = re.search(pattern, text.upper())
        if match:
            if len(match.groups()) == 3 and match.group(1).isdigit():
                day = int(match.group(1))
                month_name = match.group(2)
                year = int(match.group(3))
                month = months.get(month_name, 6)  # Default junio
                return f"2025-{month:02d}-{day:02d}"
    
    # Default: 18 de junio 2025
    return "2025-06-18"

def convert_text_to_json(text_input):
    """Convierte el texto de agenda deportiva a JSON"""
    lines = text_input.strip().split('\n')
    events = []
    current_sport_context = ""
    current_date = "2025-06-18"
    event_id = 1
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        if not line:
            i += 1
            continue
            
        # Detectar cambio de fecha
        if any(day in line.upper() for day in ['MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'DOMINGO']):
            current_date = parse_date_from_text(line)
            i += 1
            continue
            
        # Detectar contexto deportivo (categoría)
        if any(keyword in line.upper() for keyword in ['MUNDIAL DE CLUBES', 'VOLEY:', 'CICLISMO', 'HOCKEY', 'COPA ORO', 'MLB', 'NBA', 'GOLF', 'KNOCKOUT']):
            current_sport_context = line
            i += 1
            continue
            
        # Detectar hora (formato HH:MM)
        time_match = re.match(r'^(\d{1,2}):(\d{2})$', line)
        if time_match:
            time = line
            i += 1
            
            # La siguiente línea debería ser el partido
            if i < len(lines):
                match_line = lines[i].strip()
                i += 1
                
                # La siguiente línea debería ser los canales
                channels_line = ""
                if i < len(lines) and not re.match(r'^\d{1,2}:\d{2}$', lines[i].strip()):
                    channels_line = lines[i].strip()
                    i += 1
                
                # Procesar el partido
                if '│' in match_line or 'vs' in match_line.lower() or 'VS' in match_line:
                    # Es un partido entre equipos
                    if '│' in match_line:
                        teams = [team.strip() for team in match_line.split('│')]
                    else:
                        teams = [team.strip() for team in re.split(r'\s+vs\.?\s+', match_line, flags=re.IGNORECASE)]
                    
                    if len(teams) >= 2:
                        team1 = teams[0]
                        team2 = teams[1]
                        
                        # Obtener códigos de países
                        country1 = get_country_code(team1)
                        country2 = get_country_code(team2)
                        
                        # Procesar canales
                        channels = []
                        if channels_line:
                            # Separar por / y limpiar
                            channel_parts = re.split(r'[/,]', channels_line)
                            for part in channel_parts:
                                part = part.strip()
                                if part and part not in ['DGO']:
                                    channels.append(part)
                        
                        if not channels:
                            channels = ['Por confirmar']
                        
                        # Crear evento
                        event = {
                            "id": f"event_{event_id}",
                            "name": f"{team1} vs {team2}",
                            "date": current_date,
                            "time": time,
                            "sport": get_sport_from_context(current_sport_context),
                            "teams": [team1, team2],
                            "teamCountries": [country1, country2] if country1 and country2 else None,
                            "channels": channels,
                            "description": current_sport_context.strip()
                        }
                        
                        # Limpiar None values
                        if event["teamCountries"] is None:
                            del event["teamCountries"]
                        
                        events.append(event)
                        event_id += 1
                else:
                    # Es un evento sin equipos específicos (como "Etapa 1" de ciclismo)
                    channels = []
                    if channels_line:
                        channel_parts = re.split(r'[/,]', channels_line)
                        for part in channel_parts:
                            part = part.strip()
                            if part and part not in ['DGO']:
                                channels.append(part)
                    
                    if not channels:
                        channels = ['Por confirmar']
                    
                    event = {
                        "id": f"event_{event_id}",
                        "name": match_line,
                        "date": current_date,
                        "time": time,
                        "sport": get_sport_from_context(current_sport_context),
                        "teams": [],
                        "channels": channels,
                        "description": current_sport_context.strip()
                    }
                    
                    events.append(event)
                    event_id += 1
            else:
                i += 1
        else:
            i += 1
    
    return {
        "events": events,
        "lastUpdated": datetime.now().isoformat(),
        "source": "Agenda Deportiva - Texto Manual"
    }

def main():
    """Función principal"""
    print("=== CONVERTIDOR DE AGENDA DEPORTIVA A JSON ===")
    print("Pega el texto de la agenda deportiva y presiona Enter dos veces para procesar:")
    print()
    
    # Leer entrada del usuario
    lines = []
    empty_lines = 0
    
    while True:
        try:
            line = input()
            if line.strip() == "":
                empty_lines += 1
                if empty_lines >= 2:  # Dos líneas vacías consecutivas para terminar
                    break
            else:
                empty_lines = 0
                lines.append(line)
        except EOFError:
            break
    
    if not lines:
        print("No se ingresó texto. Saliendo...")
        return
    
    text_input = '\n'.join(lines)
      # Convertir a JSON
    try:
        import os
        
        json_data = convert_text_to_json(text_input)
        
        # Obtener la ruta absoluta del directorio público
        script_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(os.path.dirname(script_dir))
        output_file = os.path.join(project_root, "public", "sports_events.json")
        
        # Crear el directorio public si no existe
        public_dir = os.path.dirname(output_file)
        os.makedirs(public_dir, exist_ok=True)
        
        # Guardar el archivo
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, ensure_ascii=False, indent=2)
        
        print(f"\n✅ JSON generado exitosamente!")
        print(f"📁 Archivo guardado en: {output_file}")
        print(f"📊 Total de eventos procesados: {len(json_data['events'])}")
        
        # Mostrar resumen
        sports_count = {}
        for event in json_data['events']:
            sport = event['sport']
            sports_count[sport] = sports_count.get(sport, 0) + 1
        
        print(f"\n📈 Resumen por deporte:")
        for sport, count in sports_count.items():
            print(f"   {sport}: {count} eventos")
        
        print(f"\n🔄 Última actualización: {json_data['lastUpdated']}")
        
    except Exception as e:
        print(f"❌ Error al procesar el texto: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
