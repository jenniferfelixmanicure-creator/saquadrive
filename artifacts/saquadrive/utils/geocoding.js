const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org/search?";

export const geocodeAddress = async (address) => {
  try {
    const url = `${NOMINATIM_BASE_URL}q=${encodeURIComponent(address)}&format=json&limit=1`;
    const response = await fetch(url);
    const data = await response.json();

    if (data && data.length > 0) {
      const { lat, lon, display_name } = data[0];
      return { latitude: parseFloat(lat), longitude: parseFloat(lon), name: display_name };
    } else {
      return null;
    }
  } catch (error) {
    console.error("Erro ao geocodificar endereço:", error);
    return null;
  }
};

export const reverseGeocode = async (latitude, longitude) => {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`;
    const response = await fetch(url);
    const data = await response.json();

    if (data && data.display_name) {
      return { address: data.display_name };
    } else {
      return null;
    }
  } catch (error) {
    console.error("Erro ao reverter geocodificação:", error);
    return null;
  }
};
