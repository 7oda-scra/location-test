window.smartCodeFaceCamera = {
    startCamera: async (videoElement) => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("Camera access is not supported by this browser.");
        }

        if (!videoElement) {
            throw new Error("Camera preview is not available.");
        }

        const constraints = {
            video: {
                facingMode: "user",
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        };

        try {
            window.smartCodeFaceCamera.stopCamera(videoElement);

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            videoElement.setAttribute("autoplay", "");
            videoElement.setAttribute("muted", "");
            videoElement.setAttribute("playsinline", "");
            videoElement.muted = true;
            videoElement.playsInline = true;
            videoElement.srcObject = stream;

            await videoElement.play();
        } catch (error) {
            const name = error && error.name ? error.name : "";

            if (name === "NotAllowedError" || name === "PermissionDeniedError") {
                throw new Error("Camera permission was denied. Allow camera access to capture your face.");
            }

            if (name === "NotFoundError" || name === "DevicesNotFoundError") {
                throw new Error("No camera was found on this device.");
            }

            throw new Error("Unable to start the camera. Check browser camera permissions and try again.");
        }
    },

    stopCamera: (videoElement) => {
        if (!videoElement || !videoElement.srcObject) {
            return;
        }

        const stream = videoElement.srcObject;
        stream.getTracks().forEach((track) => track.stop());
        videoElement.srcObject = null;
    },

    captureJpeg: (videoElement, quality) => {
        if (!videoElement || !videoElement.videoWidth || !videoElement.videoHeight) {
            throw new Error("Camera is not ready yet. Wait for the preview to appear, then capture again.");
        }

        const canvas = document.createElement("canvas");
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;

        const context = canvas.getContext("2d");
        context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

        const jpegQuality = typeof quality === "number"
            ? Math.min(Math.max(quality, 0.1), 1)
            : 0.9;

        return canvas.toDataURL("image/jpeg", jpegQuality);
    }
};
