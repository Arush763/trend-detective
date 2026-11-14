"""Shared settings for the Trend Detective data pipeline."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw"          # downloaded MERRA-2 monthly subsets
OUT_DIR = ROOT / "data" / "processed"    # JSON the website reads

START_YEAR = 1980
END_YEAR = 2025  # last complete year

# MERRA-2 monthly collections (NASA GMAO, served by GES DISC) and the
# variables we pull from each. Only these variables are downloaded, not
# the whole file, so each month is small.
COLLECTIONS = {
    "M2TMNXSLV": {"prefix": "tavgM_2d_slv_Nx", "vars": ["T2M", "TQV"]},
    "M2TMNXFLX": {"prefix": "tavgM_2d_flx_Nx", "vars": ["PRECTOTCORR", "EVAP"]},
    "M2TMNXLND": {"prefix": "tavgM_2d_lnd_Nx", "vars": ["GWETROOT", "SNOMAS", "RUNOFF"]},
    "M2TMNXAER": {"prefix": "tavgM_2d_aer_Nx", "vars": ["TOTEXTTAU", "DUEXTTAU"]},
}
VERSION = "5.12.4"

# How each variable is shown to users: display name, conversion from
# MERRA-2 units, display units, and a plain-English definition.
VARIABLES = {
    "T2M": {
        "name": "Air temperature",
        "convert": lambda x: x - 273.15, "units": "°C", "pct": False,
        "definition": "How warm the air is about 2 meters above the ground.",
        "collection": "M2TMNXSLV",
    },
    "TQV": {
        "name": "Water vapor in the air",
        "convert": lambda x: x, "units": "mm",
        "definition": "All the water vapor in a column of air, written as how deep it would be if it all fell as liquid water.",
        "collection": "M2TMNXSLV",
    },
    "PRECTOTCORR": {
        "name": "Precipitation",
        "convert": lambda x: x * 86400, "units": "mm/day",
        "definition": "Rain and snow reaching the ground (bias-corrected with rain gauge data).",
        "collection": "M2TMNXFLX",
    },
    "EVAP": {
        "name": "Evaporation",
        "convert": lambda x: x * 86400, "units": "mm/day",
        "definition": "Water moving from the surface (land, plants, ocean) up into the air.",
        "collection": "M2TMNXFLX",
    },
    "GWETROOT": {
        "name": "Root-zone soil moisture",
        "convert": lambda x: x * 100, "units": "% saturated",
        "definition": "How wet the soil is down where plant roots reach (0% = bone dry, 100% = fully soaked). Land only.",
        "collection": "M2TMNXLND",
    },
    "SNOMAS": {
        "name": "Snow amount",
        "convert": lambda x: x, "units": "kg/m²",
        "definition": "How much snow is sitting on the ground, measured by weight per square meter. Land only.",
        "collection": "M2TMNXLND",
    },
    "RUNOFF": {
        "name": "Surface runoff",
        "convert": lambda x: x * 86400, "units": "mm/day",
        "definition": "Water that flows over the land surface into streams and rivers instead of soaking in. Land only.",
        "collection": "M2TMNXLND",
    },
    "TOTEXTTAU": {
        "name": "Haze / aerosols",
        "convert": lambda x: x, "units": "AOD (unitless)",
        "definition": "How much sunlight is blocked by tiny particles in the air like smoke, dust, and pollution. Higher = hazier.",
        "collection": "M2TMNXAER",
    },
    "DUEXTTAU": {
        "name": "Dust in the air",
        "convert": lambda x: x, "units": "AOD (unitless)",
        "definition": "The part of the haze that comes from desert dust.",
        "collection": "M2TMNXAER",
    },
}
