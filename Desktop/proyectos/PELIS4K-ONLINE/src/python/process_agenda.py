#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Convertidor directo de texto de agenda deportiva a JSON
"""

import json
import re
from datetime import datetime

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
    if 'MIÉRCOLES 18' in text.upper() or '18 DE JUNIO' in text.upper():
        return "2025-06-18"
    elif 'JUEVES 19' in text.upper() or '19 DE JUNIO' in text.upper():
        return "2025-06-19"
    elif 'VIERNES 20' in text.upper() or '20 DE JUNIO' in text.upper():
        return "2025-06-20"
    elif 'SÁBADO 21' in text.upper() or '21 DE JUNIO' in text.upper():
        return "2025-06-21"
    else:
        return "2025-06-18"  # Default

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
        if any(day in line.upper() for day in ['MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO']):
            current_date = parse_date_from_text(line)
            i += 1
            continue
        
        # Detectar contexto deportivo
        if any(keyword in line.upper() for keyword in ['MUNDIAL DE CLUBES', 'VOLEY:', 'CICLISMO', 'HOCKEY', 'COPA ORO', 'MLB', 'NBA', 'GOLF', 'KNOCKOUT']):
            current_sport_context = line
            i += 1
            continue
        
        # Detectar hora
        time_match = re.match(r'^(\d{1,2}):(\d{2})$', line)
        if time_match:
            time = line
            i += 1
            
            # Siguiente línea: partido
            if i < len(lines):
                match_line = lines[i].strip()
                i += 1
                
                # Siguiente línea: canales
                channels_line = ""
                if i < len(lines) and not re.match(r'^\d{1,2}:\d{2}$', lines[i].strip()) and not any(keyword in lines[i].upper() for keyword in ['MUNDIAL', 'VOLEY', 'CICLISMO', 'HOCKEY', 'COPA', 'MLB', 'NBA', 'GOLF']):
                    channels_line = lines[i].strip()
                    i += 1
                
                # Procesar partido
                if '│' in match_line:
                    teams = [team.strip() for team in match_line.split('│')]
                    
                    if len(teams) >= 2:
                        team1 = teams[0]
                        team2 = teams[1]
                        
                        country1 = get_country_code(team1)
                        country2 = get_country_code(team2)
                        
                        # Procesar canales
                        channels = []
                        if channels_line:
                            channel_parts = re.split(r'[/]', channels_line)
                            for part in channel_parts:
                                part = part.strip()
                                if part and part not in ['DGO']:
                                    channels.append(part)
                        
                        if not channels:
                            channels = ['Por confirmar']
                        
                        event = {
                            "id": f"event_{event_id}",
                            "name": f"{team1} vs {team2}",
                            "date": current_date,
                            "time": time,
                            "sport": get_sport_from_context(current_sport_context),
                            "teams": [team1, team2],
                            "channels": channels,
                            "description": current_sport_context.strip()
                        }
                        
                        # Agregar códigos de países si están disponibles
                        if country1 and country2:
                            event["teamCountries"] = [country1, country2]
                        
                        events.append(event)
                        event_id += 1
                else:
                    # Evento sin equipos específicos
                    channels = []
                    if channels_line:
                        channel_parts = re.split(r'[/]', channels_line)
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
    
    return {
        "events": events,
        "lastUpdated": datetime.now().isoformat(),
        "source": "Agenda Deportiva - Conversión Manual"
    }

# Texto de ejemplo proporcionado
text_input = """Jueves 19 de junio de 2025
VOLEY: NATIONS LEAGUE FEMENINO
06:00
TAILANDIA │ ITALIA
DSPORTS / DGO

09:30
BULGARIA │ CHINA
DSPORTS / DGO

15:00
ALEMANIA │ SERBIA
DSPORTS / DGO

MUNDIAL DE CLUBES
07:00
SEATTLE SOUNDERS │ ATLÉTICO MADRID
DAZN
DISNEY + PREMIUM
DSPORTS / DGO
TELEFE

13:00
PALMEIRAS │ AL AHLY
DAZN
DSPORTS / DGO

16:00
INTER MIAMI │ PORTO
DAZN
DSPORTS / DGO

22:00
BOTAFOGO │ PSG
DAZN
DSPORTS / DGO

GOLF: TRAVELERS CHAMPIONSHIP
16:00
PRIMERA VUELTA
DISNEY +
ESPN 3

GOLF - PGA TOUR
16:00
RONDA 1
ESPN 3

NBA
21:25
INDIANA PACERS │ OKLAHOMA CITY THUNDERS (JUEGO #6)
DISNEY + PREMIUM
ESPN 2

COPA ORO DE LA CONCACAF
19:25
TRINIDAD Y TOBAGO │ HAITÍ
DISNEY + PREMIUM

21:55
ARABIA SAUDITA │ ESTADOS UNIDOS
DISNEY +
ESPN 3

Viernes 20 de junio de 2025
VOLEY: NATIONS LEAGUE FEMENINO
09:30
JAPÓN │ ITALIA
DSPORTS / DGO

11:30
FRANCIA │ PAÍSES BAJOS
DSPORTS / DGO

13:30
CANADÁ │ BRASIL
DSPORTS + / DGO

15:00
ALEMANIA │ POLONIA
DSPORTS + / DGO

MUNDIAL DE CLUBES
13:00
BENFICA │ AUCKLAND CITY
DAZN
DSPORTS 2 / DGO

15:00
FLAMENGO │ CHELSEA
DAZN
DISNEY + PREMIUM
DSPORTS / DGO
TELEFE

19:00
LOS ANGELES FC │ ESPERACE
DAZN
DSPORTS 2 / DGO

22:00
BAYERN MUNICH │ BOCA
DAZN
DISNEY + PREMIUM
DSPORTS / DGO
TELEFE

TOP 14 DE FRANCIA
16:00
SEMIFINAL: STADE TOLOUSIAN │ CASTRES
DGO
DISNEY +
ESPN 4

TEST MATCH
16:00
BRITISH & IRISH LIONS │ ARGENTINA
DGO
DISNEY +
ESPN 2

VOLEY: DIVISIÓN DE HONOR (MASCULINA)
19:00
UNTREF │ FERRO
DGO
FOX SPORTS 2

21:00
RIVER │ BOCA
DGO
FOX SPORTS 2

ESPN KNOCKOUT
23:00
JONATHAN ROJAS │ JOSÉ ÁNGEL GARCÍA
DGO
DISNEY +
ESPN 4

COPA DE ORO
20:25
JAMAICA │ GUADALUPE
DISNEY + PREMIUM

23:00
GUATEMALA │ PANAMÁ
DGO
DISNEY +
ESPN 2

Sábado 21 de junio de 2025
MUNDIAL DE CLUBES
13:00
MAMELODI SUNDOWNS │ BORUSSIA DORTMUND
DAZN
DSPORTS / DGO

16:00
INTER DE MILÁN │ URAWA RED DIAMONDS
DAZN
DISNEY + PREMIUM
DSPORTS / DGO
TELEFE

19:00
FLUMINENSE │ ULSAN HYUNDAI
DAZN
DSPORTS 2 / DGO

22:00
RIVER │ RAYADOS DE MONTERREY
DAZN
DISNEY + PREMIUM
DSPORTS / DGO
TELEFE

MLB (MAJOR LEAGUE BASEBALL)
21:00
CHICAGO CUBS │ MILWAUKEE BUCKS
DISNEY + PREMIUM

Domingo 22 de junio de 2025
MUNDIAL DE CLUBES
13:00
JUVENTUS │ WYDAD
DAZN
DISNEY + PREMIUM
DSPORTS / DGO
TELEFE

16:00
REAL MADRID │ PACHUCA
DAZN
DSPORTS / DGO

19:00
RED BULL SALZBURGO │ AL HILAL
DAZN
DSPORTS / DGO

22:00
MANCHESTER CITY │ AL AIN
DAZN
DSPORTS / DGO"""

if __name__ == "__main__":
    try:
        import os
        
        # Convertir el texto a JSON
        json_data = convert_text_to_json(text_input)
        
        # Obtener la ruta absoluta del directorio público
        script_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(os.path.dirname(script_dir))
        output_file = os.path.join(project_root, "public", "sports_events.json")
        
        # Crear el directorio public si no existe
        public_dir = os.path.dirname(output_file)
        os.makedirs(public_dir, exist_ok=True)
        
        # Guardar en el archivo público
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, ensure_ascii=False, indent=2)
        
        print(f"✅ JSON generado exitosamente!")
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
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
