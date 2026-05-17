const OSRM_BASE_URL = "http://router.project-osrm.org/route/v1/";

export const getDirections = async (startCoords, endCoords, profile = "driving") => {
  try {
    const coordinates = `${startCoords.longitude},${startCoords.latitude};${endCoords.longitude},${endCoords.latitude}`;
    const url = `${OSRM_BASE_URL}${profile}/${coordinates}?overview=full&geometries=geojson`;

    const response = await fetch(url);
    const data = await response.json();

    if (data && data.routes && data.routes.length > 0) {
      // OSRM retorna a geometria como GeoJSON diretamente
      return data.routes[0].geometry;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Erro ao obter rotas com OSRM:", error);
    return null;
  }
};
