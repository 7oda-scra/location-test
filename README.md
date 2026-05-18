# Smart Code Attendance

Blazor WebAssembly attendance MVP with MudBlazor UI, browser geolocation, webcam selfie capture, and a Netlify Function that verifies location plus Luxand.cloud face identity.

## Netlify Environment Variables

Set these in Netlify under **Site configuration > Environment variables**:

```text
LUXAND_API_TOKEN=your_luxand_cloud_token
WORKPLACE_LAT=30.786776
WORKPLACE_LNG=31.001057
WORKPLACE_RADIUS_METERS=100
FACE_VERIFY_THRESHOLD=0.75
REQUIRE_LIVENESS=false
EMPLOYEE_FACE_MAP_JSON={"Ahmed":"PUT_AHMED_LUXAND_UUID_HERE"}
```

`LUXAND_API_TOKEN` must never be placed in Blazor WASM `appsettings`, Razor files, JavaScript, or any frontend code. The browser posts the employee name, GPS position, and selfie only to `/.netlify/functions/sign-attendance`; the function keeps the token server-side and calls Luxand.

## Luxand Enrollment

1. Create or enroll each employee as a person in Luxand.cloud using Luxand's person enrollment flow.
2. Store the returned Luxand person UUID for that employee.
3. Add the employee name and UUID to `EMPLOYEE_FACE_MAP_JSON`, for example:

```json
{"Ahmed":"PUT_AHMED_LUXAND_UUID_HERE","Sara":"PUT_SARA_LUXAND_UUID_HERE"}
```

The function looks up the UUID from this server-side map. It does not trust a UUID sent from the browser.

## Attendance Decision

The Netlify Function recalculates workplace distance with the Haversine formula. If the employee is outside `WORKPLACE_RADIUS_METERS`, it denies attendance without calling Luxand. If location passes, it optionally checks liveness when `REQUIRE_LIVENESS=true`, then calls Luxand face verification. Attendance is approved only when both location and face verification pass.
