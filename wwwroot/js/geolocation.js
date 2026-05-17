window.smartCodeGeo = {
    getCurrentPosition: () => new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject("Geolocation is not supported by this browser.");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp
                });
            },
            (error) => {
                const messages = {
                    1: "Location permission was denied. Allow location access to sign attendance.",
                    2: "Your current location is unavailable. Check GPS, Wi-Fi, or browser location services.",
                    3: "The location request timed out. Please try again."
                };

                reject(messages[error.code] || "Unable to read your current location.");
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0
            });
    })
};
