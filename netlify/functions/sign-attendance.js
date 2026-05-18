const Busboy = require("busboy");

const LUXAND_BASE_URL = "https://api.luxand.cloud";
const DEFAULT_FACE_VERIFY_THRESHOLD = 0.75;
const DEFAULT_LIVENESS_THRESHOLD = 0.75;

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") {
        return {
            statusCode: 204,
            headers: corsHeaders()
        };
    }

    if (event.httpMethod !== "POST") {
        return jsonResponse(405, {
            approved: false,
            locationApproved: false,
            faceApproved: false,
            livenessApproved: null,
            employeeName: "",
            distanceMeters: null,
            confidence: null,
            reason: "invalid_request"
        });
    }

    try {
        const config = readConfig();

        if (!config.ok) {
            return jsonResponse(500, deniedResponse("server_config_error"));
        }

        const { fields, files } = await parseMultipart(event);
        const name = normalizeText(fields.name);
        const latitude = parseNumber(fields.latitude);
        const longitude = parseNumber(fields.longitude);
        const employeeMap = parseEmployeeMap(process.env.EMPLOYEE_FACE_MAP_JSON);
        const personUuid = findPersonUuid(employeeMap, name);
        const photo = files.photo;

        if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude) || !photo || !photo.buffer.length) {
            return jsonResponse(400, deniedResponse("invalid_request", { employeeName: name }));
        }

        if (!personUuid) {
            return jsonResponse(404, deniedResponse("unknown_employee", { employeeName: name }));
        }

        const distanceMeters = calculateDistanceMeters(
            latitude,
            longitude,
            config.workplaceLat,
            config.workplaceLng);

        if (distanceMeters > config.workplaceRadiusMeters) {
            return jsonResponse(200, {
                approved: false,
                locationApproved: false,
                faceApproved: false,
                livenessApproved: null,
                employeeName: name,
                distanceMeters,
                confidence: null,
                reason: "outside_workspace"
            });
        }

        let livenessApproved = null;

        if (config.requireLiveness) {
            const livenessResult = await callLuxand("/photo/liveness/v2", photo, config.luxandToken);

            if (!livenessResult.ok) {
                return jsonResponse(502, {
                    ...deniedResponse("luxand_api_error", {
                        employeeName: name,
                        distanceMeters,
                        livenessApproved: false
                    }),
                    rawLuxandLiveness: developmentRaw(livenessResult.data)
                });
            }

            const livenessDecision = extractLivenessDecision(livenessResult.data);
            livenessApproved = livenessDecision.approved;

            if (!livenessApproved) {
                return jsonResponse(200, {
                    approved: false,
                    locationApproved: true,
                    faceApproved: false,
                    livenessApproved: false,
                    employeeName: name,
                    distanceMeters,
                    confidence: null,
                    reason: "liveness_failed",
                    rawLuxandLiveness: developmentRaw(livenessResult.data)
                });
            }
        }

        const verifyResult = await callLuxand(`/photo/verify/${encodeURIComponent(personUuid)}`, photo, config.luxandToken);

        if (!verifyResult.ok) {
            return jsonResponse(502, deniedResponse("luxand_api_error", {
                employeeName: name,
                distanceMeters,
                livenessApproved
            }));
        }

        const confidence = extractConfidence(verifyResult.data);
        const explicitMatch = extractBoolean(verifyResult.data, ["verified", "match", "matched", "isMatch"]);
        const faceApproved = explicitMatch ?? (confidence !== null && confidence >= config.faceVerifyThreshold);
        const approved = faceApproved;

        return jsonResponse(200, {
            approved,
            locationApproved: true,
            faceApproved,
            livenessApproved,
            employeeName: name,
            distanceMeters,
            confidence,
            reason: approved ? "approved" : "face_mismatch"
        });
    } catch (error) {
        return jsonResponse(500, deniedResponse("luxand_api_error"));
    }
};

function readConfig() {
    const workplaceLat = parseNumber(process.env.WORKPLACE_LAT);
    const workplaceLng = parseNumber(process.env.WORKPLACE_LNG);
    const workplaceRadiusMeters = parseNumber(process.env.WORKPLACE_RADIUS_METERS);
    const luxandToken = process.env.LUXAND_API_TOKEN;

    return {
        ok: Boolean(luxandToken)
            && Number.isFinite(workplaceLat)
            && Number.isFinite(workplaceLng)
            && Number.isFinite(workplaceRadiusMeters)
            && workplaceRadiusMeters > 0,
        luxandToken,
        workplaceLat,
        workplaceLng,
        workplaceRadiusMeters,
        faceVerifyThreshold: parseNumber(process.env.FACE_VERIFY_THRESHOLD) || DEFAULT_FACE_VERIFY_THRESHOLD,
        requireLiveness: parseBoolean(process.env.REQUIRE_LIVENESS)
    };
}

function parseMultipart(event) {
    return new Promise((resolve, reject) => {
        const contentType = getHeader(event.headers, "content-type");

        if (!contentType || !contentType.includes("multipart/form-data")) {
            reject(new Error("Expected multipart form-data."));
            return;
        }

        const fields = {};
        const files = {};
        const busboy = Busboy({
            headers: { "content-type": contentType },
            limits: {
                files: 1,
                fileSize: 6 * 1024 * 1024,
                fields: 8
            }
        });

        busboy.on("field", (name, value) => {
            fields[name] = value;
        });

        busboy.on("file", (name, file, info) => {
            const chunks = [];

            file.on("data", (chunk) => chunks.push(chunk));
            file.on("limit", () => reject(new Error("Photo is too large.")));
            file.on("end", () => {
                files[name] = {
                    filename: info.filename || "selfie.jpg",
                    mimeType: info.mimeType || "image/jpeg",
                    buffer: Buffer.concat(chunks)
                };
            });
        });

        busboy.on("error", reject);
        busboy.on("finish", () => resolve({ fields, files }));

        const body = Buffer.from(event.body || "", event.isBase64Encoded ? "base64" : "utf8");
        busboy.end(body);
    });
}

async function callLuxand(path, photo, token) {
    const formData = new FormData();
    const blob = new Blob([photo.buffer], { type: photo.mimeType || "image/jpeg" });
    formData.append("photo", blob, photo.filename || "selfie.jpg");

    const response = await fetch(`${LUXAND_BASE_URL}${path}`, {
        method: "POST",
        headers: { token },
        body: formData
    });

    const data = await parseJsonOrText(response);

    return {
        ok: response.ok,
        status: response.status,
        data
    };
}

async function parseJsonOrText(response) {
    const text = await response.text();

    if (!text) {
        return null;
    }

    try {
        return JSON.parse(text);
    } catch {
        return { raw: text };
    }
}

function parseEmployeeMap(json) {
    if (!json) {
        return {};
    }

    try {
        const parsed = JSON.parse(json);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
}

function findPersonUuid(employeeMap, name) {
    if (!name) {
        return null;
    }

    if (typeof employeeMap[name] === "string") {
        return employeeMap[name];
    }

    const normalizedName = name.toLocaleLowerCase();
    const match = Object.entries(employeeMap)
        .find(([employeeName]) => employeeName.toLocaleLowerCase() === normalizedName);

    return match && typeof match[1] === "string" ? match[1] : null;
}

function calculateDistanceMeters(latitude1, longitude1, latitude2, longitude2) {
    const earthRadiusMeters = 6371000;
    const lat1Radians = degreesToRadians(latitude1);
    const lat2Radians = degreesToRadians(latitude2);
    const deltaLatitude = degreesToRadians(latitude2 - latitude1);
    const deltaLongitude = degreesToRadians(longitude2 - longitude1);
    const haversine = Math.sin(deltaLatitude / 2) ** 2
        + Math.cos(lat1Radians) * Math.cos(lat2Radians) * Math.sin(deltaLongitude / 2) ** 2;
    const angularDistance = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

    return earthRadiusMeters * angularDistance;
}

function degreesToRadians(degrees) {
    return degrees * Math.PI / 180;
}

function extractConfidence(data) {
    const value = findValue(data, ["confidence", "score", "similarity", "probability"]);
    const parsed = parseNumber(value);

    if (!Number.isFinite(parsed)) {
        return null;
    }

    return parsed > 1 && parsed <= 100 ? parsed / 100 : parsed;
}

function extractBoolean(data, keys) {
    const value = findValue(data, keys);

    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value === "string") {
        const normalized = value.toLocaleLowerCase();

        if (["true", "yes", "match", "matched", "verified"].includes(normalized)) {
            return true;
        }

        if (["false", "no", "mismatch", "not_matched", "unverified"].includes(normalized)) {
            return false;
        }
    }

    return null;
}

function extractLivenessDecision(data) {
    const explicitLive = extractBoolean(data, ["live", "liveness", "isLive", "real", "isReal"]);

    if (explicitLive !== null) {
        return { approved: explicitLive };
    }

    const status = findValue(data, ["result", "status", "label"]);

    if (typeof status === "string") {
        const normalized = status.toLocaleLowerCase();

        if (normalized.includes("live") || normalized.includes("real")) {
            return { approved: true };
        }

        if (normalized.includes("spoof") || normalized.includes("fake")) {
            return { approved: false };
        }
    }

    const probability = parseNumber(findValue(data, ["liveness", "livenessProbability", "probability", "score", "confidence"]));

    if (Number.isFinite(probability)) {
        const normalizedProbability = probability > 1 && probability <= 100 ? probability / 100 : probability;
        return { approved: normalizedProbability >= DEFAULT_LIVENESS_THRESHOLD };
    }

    return { approved: false };
}

function findValue(value, keys, depth = 0) {
    if (!value || typeof value !== "object" || depth > 4) {
        return undefined;
    }

    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
            return value[key];
        }
    }

    for (const child of Object.values(value)) {
        const found = findValue(child, keys, depth + 1);

        if (found !== undefined) {
            return found;
        }
    }

    return undefined;
}

function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
}

function parseNumber(value) {
    if (value === null || value === undefined || value === "") {
        return NaN;
    }

    return Number(value);
}

function parseBoolean(value) {
    return String(value || "").toLocaleLowerCase() === "true";
}

function getHeader(headers, name) {
    const normalizedName = name.toLocaleLowerCase();
    const match = Object.entries(headers || {})
        .find(([key]) => key.toLocaleLowerCase() === normalizedName);

    return match ? match[1] : "";
}

function deniedResponse(reason, overrides = {}) {
    return {
        approved: false,
        locationApproved: false,
        faceApproved: false,
        livenessApproved: null,
        employeeName: "",
        distanceMeters: null,
        confidence: null,
        reason,
        ...overrides
    };
}

function developmentRaw(data) {
    return process.env.LUXAND_DEBUG === "true" || process.env.CONTEXT === "dev"
        ? data
        : undefined;
}

function jsonResponse(statusCode, body) {
    return {
        statusCode,
        headers: {
            ...corsHeaders(),
            "content-type": "application/json"
        },
        body: JSON.stringify(body)
    };
}

function corsHeaders() {
    return {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "content-type",
        "access-control-allow-methods": "POST, OPTIONS"
    };
}
